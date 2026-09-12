package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.dto.PlayerDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.PlayerNotActiveClubMemberException;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/029-league-management.md: {@code list}/{@code add}/{@code remove}
 * all first verify {@code teamId} and {@code seasonId} each belong to {@code clubId} ({@link
 * #findTeamOrThrowForClub}/{@link #findSeasonOrThrowForClub}); {@code add} additionally verifies
 * {@code playerId} belongs to {@code clubId} ({@link #findPlayerOrThrowForClub}) and is currently
 * active — validated via {@code PlayerProfile.active} rather than a second {@code
 * ClubMembership} query, since {@code PlayerServiceImpl} already keeps the two in lockstep (see
 * the spec's Rollout Notes) — throwing {@link PlayerNotActiveClubMemberException} (400) if not,
 * and {@link ConflictException} (409) if already in that season's squad; {@code remove} throws
 * {@link NotFoundException} if not currently in that season's squad. Every query is scoped by
 * {@code (teamId, seasonId)} together, never {@code teamId} alone, per this spec's season-scoping
 * amendment.
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

    public TeamSquadServiceImpl(
            TeamRepository teamRepository,
            SeasonRepository seasonRepository,
            PlayerProfileRepository playerProfileRepository,
            PersonRepository personRepository,
            PlayerSectionRepository playerSectionRepository,
            TeamSquadMemberRepository teamSquadMemberRepository,
            PlayerMapper playerMapper) {
        this.teamRepository = teamRepository;
        this.seasonRepository = seasonRepository;
        this.playerProfileRepository = playerProfileRepository;
        this.personRepository = personRepository;
        this.playerSectionRepository = playerSectionRepository;
        this.teamSquadMemberRepository = teamSquadMemberRepository;
        this.playerMapper = playerMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PlayerDto> list(UUID clubId, UUID teamId, UUID seasonId) {
        findTeamOrThrowForClub(clubId, teamId);
        findSeasonOrThrowForClub(clubId, seasonId);

        return teamSquadMemberRepository.findByTeamIdAndSeasonId(teamId, seasonId).stream()
                .map(member -> toPlayerDto(member.getPlayerProfileId()))
                .toList();
    }

    @Override
    @Transactional
    public PlayerDto add(UUID clubId, UUID teamId, UUID seasonId, UUID playerId) {
        findTeamOrThrowForClub(clubId, teamId);
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
                .build();
        teamSquadMemberRepository.save(member);

        return toPlayerDto(playerId);
    }

    @Override
    @Transactional
    public void remove(UUID clubId, UUID teamId, UUID seasonId, UUID playerId) {
        findTeamOrThrowForClub(clubId, teamId);
        findSeasonOrThrowForClub(clubId, seasonId);

        teamSquadMemberRepository
                .findByTeamIdAndSeasonIdAndPlayerProfileId(teamId, seasonId, playerId)
                .orElseThrow(() -> new NotFoundException(
                        "Player " + playerId + " is not in team " + teamId + "'s squad for season "
                                + seasonId));

        teamSquadMemberRepository.deleteByTeamIdAndSeasonIdAndPlayerProfileId(
                teamId, seasonId, playerId);
    }

    private PlayerDto toPlayerDto(UUID playerProfileId) {
        PlayerProfile profile = playerProfileRepository
                .findById(playerProfileId)
                .orElseThrow(() -> new NotFoundException("Player not found: " + playerProfileId));
        Person person = personRepository
                .findById(profile.getPersonId())
                .orElseThrow(() -> new NotFoundException("Person not found: " + profile.getPersonId()));
        List<UUID> sectionIds = playerSectionRepository.findByPlayerProfileId(profile.getId()).stream()
                .map(PlayerSection::getSectionId)
                .toList();
        return playerMapper.toDto(person, profile, sectionIds);
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
