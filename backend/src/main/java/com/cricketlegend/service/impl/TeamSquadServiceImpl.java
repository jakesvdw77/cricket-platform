package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.dto.TeamSquadMemberDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.DuplicateSquadJerseyNumberException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.PlayerNotActiveClubMemberException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.PlayerMapper;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.TeamSquadService;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/029-league-management.md: {@code list}/{@code add}/{@code
 * update}/{@code remove} all first verify {@code teamId} and {@code seasonId} each belong to
 * {@code clubId} ({@link #findTeamOrThrowForClub}/{@link #findSeasonOrThrowForClub}); {@code add}
 * additionally verifies {@code playerId} belongs to {@code clubId} ({@link
 * #findPlayerOrThrowForClub}) and is currently active — validated via {@code
 * PlayerProfile.active} rather than a second {@code ClubMembership} query, since {@code
 * PlayerServiceImpl} already keeps the two in lockstep (see the spec's Rollout Notes) — throwing
 * {@link PlayerNotActiveClubMemberException} (400) if not, and {@link ConflictException} (409) if
 * already in that season's squad; {@code remove} throws {@link NotFoundException} if not
 * currently in that season's squad. Every query is scoped by {@code (teamId, seasonId)} together,
 * never {@code teamId} alone, per this spec's season-scoping amendment.
 *
 * <p>Per docs/specs/031-jersey-numbers.md: {@code add}'s new {@code TeamSquadMember} row copies
 * the player's current {@code PlayerProfile.jerseyNumber} as its own starting {@code
 * jerseyNumber} (a plain value copy, never checked for uniqueness at add-time); {@code update} is
 * this entity's first-ever mutation of an already-added row — it 404s ({@link NotFoundException})
 * if the player isn't currently in that season's squad, rejects a negative number ({@link
 * ValidationException}, 400), and rejects a number another squad member already holds for this
 * team+season ({@link DuplicateSquadJerseyNumberException}, 409).
 *
 * <p>Per docs/specs/057-team-extended-profile.md: {@code update} also accepts {@code isCaptain}.
 * When {@code true}, {@link #unsetOtherCaptains} un-marks whoever else currently holds the
 * captaincy for this {@code (teamId, seasonId)} via {@code saveAndFlush} (the same Hibernate
 * flush-ordering fix {@code SponsorContactServiceImpl.unsetOtherActivePrimaries}/{@code
 * ClubContactServiceImpl.unsetOtherActivePrimaries} already established), then this member's own
 * {@code isCaptain} is set {@code true}; when {@code false}, it's just set {@code false} - no
 * other row is touched.
 */
@Service
public class TeamSquadServiceImpl implements TeamSquadService {

    private final TeamRepository teamRepository;
    private final SeasonRepository seasonRepository;
    private final PlayerProfileRepository playerProfileRepository;
    private final PersonRepository personRepository;
    private final PlayerSectionRepository playerSectionRepository;
    private final TeamSquadMemberRepository teamSquadMemberRepository;
    private final PlayerMapper playerMapper;
    private final AccessService accessService;

    public TeamSquadServiceImpl(
            TeamRepository teamRepository,
            SeasonRepository seasonRepository,
            PlayerProfileRepository playerProfileRepository,
            PersonRepository personRepository,
            PlayerSectionRepository playerSectionRepository,
            TeamSquadMemberRepository teamSquadMemberRepository,
            PlayerMapper playerMapper,
            AccessService accessService) {
        this.teamRepository = teamRepository;
        this.seasonRepository = seasonRepository;
        this.playerProfileRepository = playerProfileRepository;
        this.personRepository = personRepository;
        this.playerSectionRepository = playerSectionRepository;
        this.teamSquadMemberRepository = teamSquadMemberRepository;
        this.playerMapper = playerMapper;
        this.accessService = accessService;
    }

    @Override
    @Transactional(readOnly = true)
    public List<TeamSquadMemberDto> list(Authentication authentication, UUID clubId, UUID teamId, UUID seasonId) {
        Team team = findTeamOrThrowForClub(clubId, teamId);
        accessService.assertCanAdministerSection(authentication, clubId, team.getSectionId());
        findSeasonOrThrowForClub(clubId, seasonId);

        return teamSquadMemberRepository.findByTeamIdAndSeasonId(teamId, seasonId).stream()
                .map(this::toSquadMemberDto)
                .toList();
    }

    @Override
    @Transactional
    public TeamSquadMemberDto add(Authentication authentication, UUID clubId, UUID teamId, UUID seasonId, UUID playerId) {
        Team team = findTeamOrThrowForClub(clubId, teamId);
        accessService.assertCanAdministerSection(authentication, clubId, team.getSectionId());
        findSeasonOrThrowForClub(clubId, seasonId);
        PlayerProfile profile = findPlayerOrThrowForClub(clubId, playerId);

        if (!profile.isActive()) {
            throw new PlayerNotActiveClubMemberException(
                    "Player " + playerId + " is not currently an active member of this club");
        }
        if (teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndPlayerProfileId(
                teamId, seasonId, playerId)) {
            throw new ConflictException(
                    "Player " + playerId + " is already in team " + teamId + "'s squad for season "
                            + seasonId);
        }

        TeamSquadMember member = TeamSquadMember.builder()
                .teamId(teamId)
                .seasonId(seasonId)
                .playerProfileId(playerId)
                .jerseyNumber(profile.getJerseyNumber())
                .build();
        member = teamSquadMemberRepository.save(member);

        return toSquadMemberDto(member);
    }

    @Override
    @Transactional
    public TeamSquadMemberDto update(
            Authentication authentication,
            UUID clubId,
            UUID teamId,
            UUID seasonId,
            UUID playerId,
            Integer jerseyNumber,
            boolean isCaptain) {
        Team team = findTeamOrThrowForClub(clubId, teamId);
        accessService.assertCanAdministerSection(authentication, clubId, team.getSectionId());
        findSeasonOrThrowForClub(clubId, seasonId);

        TeamSquadMember member = teamSquadMemberRepository
                .findByTeamIdAndSeasonIdAndPlayerProfileId(teamId, seasonId, playerId)
                .orElseThrow(() -> new NotFoundException(
                        "Player " + playerId + " is not in team " + teamId + "'s squad for season "
                                + seasonId));

        if (jerseyNumber != null && jerseyNumber < 0) {
            throw new ValidationException("Jersey number must not be negative: " + jerseyNumber);
        }
        if (jerseyNumber != null
                && teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndJerseyNumberAndIdNot(
                        teamId, seasonId, jerseyNumber, member.getId())) {
            throw new DuplicateSquadJerseyNumberException(
                    "Jersey number " + jerseyNumber + " is already assigned on team " + teamId
                            + "'s squad for season " + seasonId);
        }

        member.setJerseyNumber(jerseyNumber);
        if (isCaptain) {
            unsetOtherCaptains(teamId, seasonId, member.getId());
            member.setCaptain(true);
        } else {
            member.setCaptain(false);
        }
        member = teamSquadMemberRepository.save(member);

        return toSquadMemberDto(member);
    }

    @Override
    @Transactional
    public void remove(Authentication authentication, UUID clubId, UUID teamId, UUID seasonId, UUID playerId) {
        Team team = findTeamOrThrowForClub(clubId, teamId);
        accessService.assertCanAdministerSection(authentication, clubId, team.getSectionId());
        findSeasonOrThrowForClub(clubId, seasonId);

        teamSquadMemberRepository
                .findByTeamIdAndSeasonIdAndPlayerProfileId(teamId, seasonId, playerId)
                .orElseThrow(() -> new NotFoundException(
                        "Player " + playerId + " is not in team " + teamId + "'s squad for season "
                                + seasonId));

        teamSquadMemberRepository.deleteByTeamIdAndSeasonIdAndPlayerProfileId(
                teamId, seasonId, playerId);
    }

    /**
     * Unsets {@code isCaptain} on every other squad member for {@code (teamId, seasonId)} — the
     * auto-unset behavior the spec requires, silent, not a {@link ConflictException}. Uses {@code
     * saveAndFlush}, not {@code save}: Hibernate's default flush ordering applies every pending
     * {@code INSERT} in a transaction before any pending {@code UPDATE}, regardless of
     * registration order — so this member's own (already-captain) row save would otherwise hit
     * Postgres while this unset is still a queued, unflushed update, tripping the partial unique
     * index {@code ux_team_squad_captain} instead of silently succeeding. Flushing here forces the
     * unset to commit to the DB before the caller's own save proceeds. See {@code
     * ClubContactServiceImpl.unsetOtherActivePrimaries}'s Javadoc for the full mechanism this
     * applies from day one.
     */
    private void unsetOtherCaptains(UUID teamId, UUID seasonId, UUID excludeMemberId) {
        for (TeamSquadMember existing :
                teamSquadMemberRepository.findByTeamIdAndSeasonIdAndIsCaptainTrue(teamId, seasonId)) {
            if (!existing.getId().equals(excludeMemberId)) {
                existing.setCaptain(false);
                teamSquadMemberRepository.saveAndFlush(existing);
            }
        }
    }

    private TeamSquadMemberDto toSquadMemberDto(UUID playerProfileId, TeamSquadMember member) {
        PlayerProfile profile = playerProfileRepository
                .findById(playerProfileId)
                .orElseThrow(() -> new NotFoundException("Player not found: " + playerProfileId));
        Person person = personRepository
                .findById(profile.getPersonId())
                .orElseThrow(() -> new NotFoundException("Person not found: " + profile.getPersonId()));
        List<UUID> sectionIds = playerSectionRepository.findByPlayerProfileId(profile.getId()).stream()
                .map(PlayerSection::getSectionId)
                .toList();
        return playerMapper.toSquadMemberDto(person, profile, member, sectionIds);
    }

    private TeamSquadMemberDto toSquadMemberDto(TeamSquadMember member) {
        return toSquadMemberDto(member.getPlayerProfileId(), member);
    }

    private Team findTeamOrThrowForClub(UUID clubId, UUID teamId) {
        Team team = teamRepository
                .findById(teamId)
                .orElseThrow(() -> new NotFoundException("Team not found: " + teamId));
        if (!team.getClubId().equals(clubId)) {
            throw new NotFoundException("Team not found: " + teamId);
        }
        return team;
    }

    private Season findSeasonOrThrowForClub(UUID clubId, UUID seasonId) {
        Season season = seasonRepository
                .findById(seasonId)
                .orElseThrow(() -> new NotFoundException("Season not found: " + seasonId));
        if (!season.getClubId().equals(clubId)) {
            throw new NotFoundException("Season not found: " + seasonId);
        }
        return season;
    }

    private PlayerProfile findPlayerOrThrowForClub(UUID clubId, UUID playerId) {
        PlayerProfile profile = playerProfileRepository
                .findById(playerId)
                .orElseThrow(() -> new NotFoundException("Player not found: " + playerId));
        if (!profile.getClubId().equals(clubId)) {
            throw new NotFoundException("Player not found: " + playerId);
        }
        return profile;
    }
}
