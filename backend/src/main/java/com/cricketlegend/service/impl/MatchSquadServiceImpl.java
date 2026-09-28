package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSquadMember;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.SquadMode;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.MatchSquadCandidateDto;
import com.cricketlegend.dto.MatchSquadDto;
import com.cricketlegend.dto.MatchSquadMemberDto;
import com.cricketlegend.dto.MatchSquadPickedElsewhereDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.DuplicateMatchSquadJerseyNumberException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.PlayerAlreadyPickedForWindowException;
import com.cricketlegend.exception.SectionAvailabilityWindowRequiredException;
import com.cricketlegend.exception.TeamSquadModeMismatchException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.PlayerMapper;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSquadMemberRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.MatchSquadService;
import com.cricketlegend.service.SectionAvailabilityMatchResolver;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/063-section-availability-and-flexible-squads.md's Data Model
 * Changes/API Contract (Part B/C): every method resolves the real {@link Team} for {@code teamId}
 * first (confirming it's one of the match's own home/away sides, {@link ValidationException},
 * matching {@code MatchSideServiceImpl.createSide}'s identical check, and belongs to {@code
 * clubId}), then asserts {@link AccessService#assertCanAdministerSection} before any other
 * business validation, mirroring {@code TeamSquadServiceImpl}'s own call shape, then requires
 * {@code squadMode == FLEXIBLE} ({@link TeamSquadModeMismatchException}, 400). {@link #add}
 * additionally requires a {@code SectionAvailabilityWindow} to already exist for the resolved
 * {@code (team.sectionId, match.matchDate's date, match.matchDate's day-part)} bracket ({@link
 * SectionAvailabilityWindowRequiredException}, 400, via the shared {@link
 * SectionAvailabilityMatchResolver#resolveWindowKey}), then a real, active player of this club
 * ({@link NotFoundException}, 404), then rejects a player already picked for this same resolved
 * window elsewhere ({@link PlayerAlreadyPickedForWindowException}, 409 — the service-layer,
 * clean-error-message counterpart to the DB's own {@code
 * (section_availability_window_id, player_profile_id)} unique constraint), then a duplicate pick
 * for this exact match+team ({@link ConflictException}, 409). {@link #updateJerseyNumber} mirrors
 * {@code TeamSquadServiceImpl.update}'s jersey-number rules exactly (negative rejected, {@link
 * ValidationException}; duplicate rejected, {@link DuplicateMatchSquadJerseyNumberException}).
 * {@link #remove} is a hard delete of the join row, matching {@code TeamSquadMember}'s own
 * unlink-only posture.
 */
@Service
public class MatchSquadServiceImpl implements MatchSquadService {

    private final MatchRepository matchRepository;
    private final TeamRepository teamRepository;
    private final MatchSquadMemberRepository matchSquadMemberRepository;
    private final SectionAvailabilityWindowRepository sectionAvailabilityWindowRepository;
    private final SectionAvailabilityResponseRepository sectionAvailabilityResponseRepository;
    private final SectionAvailabilityMatchResolver matchResolver;
    private final PlayerProfileRepository playerProfileRepository;
    private final PersonRepository personRepository;
    private final PlayerSectionRepository playerSectionRepository;
    private final PlayerMapper playerMapper;
    private final AccessService accessService;

    public MatchSquadServiceImpl(
            MatchRepository matchRepository,
            TeamRepository teamRepository,
            MatchSquadMemberRepository matchSquadMemberRepository,
            SectionAvailabilityWindowRepository sectionAvailabilityWindowRepository,
            SectionAvailabilityResponseRepository sectionAvailabilityResponseRepository,
            SectionAvailabilityMatchResolver matchResolver,
            PlayerProfileRepository playerProfileRepository,
            PersonRepository personRepository,
            PlayerSectionRepository playerSectionRepository,
            PlayerMapper playerMapper,
            AccessService accessService) {
        this.matchRepository = matchRepository;
        this.teamRepository = teamRepository;
        this.matchSquadMemberRepository = matchSquadMemberRepository;
        this.sectionAvailabilityWindowRepository = sectionAvailabilityWindowRepository;
        this.sectionAvailabilityResponseRepository = sectionAvailabilityResponseRepository;
        this.matchResolver = matchResolver;
        this.playerProfileRepository = playerProfileRepository;
        this.personRepository = personRepository;
        this.playerSectionRepository = playerSectionRepository;
        this.playerMapper = playerMapper;
        this.accessService = accessService;
    }

    @Override
    @Transactional(readOnly = true)
    public MatchSquadDto get(Authentication authentication, UUID clubId, UUID matchId, UUID teamId) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        Team team = findTeamOrThrowForMatchSide(clubId, match, teamId);
        accessService.assertCanAdministerSection(authentication, clubId, team.getSectionId());
        requireFlexible(team);

        return buildSquadDto(team, match);
    }

    @Override
    @Transactional
    public MatchSquadMemberDto add(Authentication authentication, UUID clubId, UUID matchId, UUID teamId, UUID playerId) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        Team team = findTeamOrThrowForMatchSide(clubId, match, teamId);
        accessService.assertCanAdministerSection(authentication, clubId, team.getSectionId());
        requireFlexible(team);

        SectionAvailabilityWindow window = findWindowOrThrowRequired(team, match);
        PlayerProfile profile = findActivePlayerOrThrowForClub(clubId, playerId);

        matchSquadMemberRepository
                .findBySectionAvailabilityWindowIdAndPlayerProfileId(window.getId(), playerId)
                .filter(existing -> !(existing.getMatchId().equals(matchId) && existing.getTeamId().equals(teamId)))
                .ifPresent(existing -> {
                    String teamName = teamRepository.findById(existing.getTeamId()).map(Team::getName).orElse("another team");
                    throw new PlayerAlreadyPickedForWindowException(
                            "Player " + playerId + " is already picked for match " + existing.getMatchId()
                                    + ", team " + existing.getTeamId() + " (" + teamName + ") in this same bracket");
                });

        if (matchSquadMemberRepository.existsByMatchIdAndTeamIdAndPlayerProfileId(matchId, teamId, playerId)) {
            throw new ConflictException(
                    "Player " + playerId + " is already in this match+team's squad");
        }

        MatchSquadMember member = MatchSquadMember.builder()
                .matchId(matchId)
                .teamId(teamId)
                .sectionAvailabilityWindowId(window.getId())
                .playerProfileId(playerId)
                .jerseyNumber(profile.getJerseyNumber())
                .build();
        member = matchSquadMemberRepository.save(member);

        return toMemberDto(member);
    }

    @Override
    @Transactional
    public void remove(Authentication authentication, UUID clubId, UUID matchId, UUID teamId, UUID playerId) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        Team team = findTeamOrThrowForMatchSide(clubId, match, teamId);
        accessService.assertCanAdministerSection(authentication, clubId, team.getSectionId());
        requireFlexible(team);

        matchSquadMemberRepository
                .findByMatchIdAndTeamIdAndPlayerProfileId(matchId, teamId, playerId)
                .orElseThrow(() -> new NotFoundException(
                        "Player " + playerId + " is not in this match+team's squad"));
        matchSquadMemberRepository.deleteByMatchIdAndTeamIdAndPlayerProfileId(matchId, teamId, playerId);
    }

    @Override
    @Transactional
    public MatchSquadMemberDto updateJerseyNumber(
            Authentication authentication, UUID clubId, UUID matchId, UUID teamId, UUID playerId, Integer jerseyNumber) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        Team team = findTeamOrThrowForMatchSide(clubId, match, teamId);
        accessService.assertCanAdministerSection(authentication, clubId, team.getSectionId());
        requireFlexible(team);

        MatchSquadMember member = matchSquadMemberRepository
                .findByMatchIdAndTeamIdAndPlayerProfileId(matchId, teamId, playerId)
                .orElseThrow(() -> new NotFoundException(
                        "Player " + playerId + " is not in this match+team's squad"));

        if (jerseyNumber != null && jerseyNumber < 0) {
            throw new ValidationException("Jersey number must not be negative: " + jerseyNumber);
        }
        if (jerseyNumber != null
                && matchSquadMemberRepository.existsByMatchIdAndTeamIdAndJerseyNumberAndIdNot(
                        matchId, teamId, jerseyNumber, member.getId())) {
            throw new DuplicateMatchSquadJerseyNumberException(
                    "Jersey number " + jerseyNumber + " is already assigned on this match+team's squad");
        }

        member.setJerseyNumber(jerseyNumber);
        member = matchSquadMemberRepository.save(member);

        return toMemberDto(member);
    }

    private void requireFlexible(Team team) {
        if (team.getSquadMode() != SquadMode.FLEXIBLE) {
            throw new TeamSquadModeMismatchException(
                    "Team " + team.getId() + " is not FLEXIBLE squad mode");
        }
    }

    private SectionAvailabilityWindow findWindowOrThrowRequired(Team team, Match match) {
        SectionAvailabilityMatchResolver.WindowKey key = matchResolver.resolveWindowKey(team, match);
        return sectionAvailabilityWindowRepository
                .findBySectionIdAndWindowDateAndDayPart(key.sectionId(), key.windowDate(), key.dayPart())
                .orElseThrow(() -> new SectionAvailabilityWindowRequiredException(
                        "No section availability window exists yet for section " + key.sectionId() + " on "
                                + key.windowDate() + " (" + key.dayPart() + ")"));
    }

    private MatchSquadDto buildSquadDto(Team team, Match match) {
        SectionAvailabilityMatchResolver.WindowKey key = matchResolver.resolveWindowKey(team, match);
        Optional<SectionAvailabilityWindow> windowOpt = sectionAvailabilityWindowRepository
                .findBySectionIdAndWindowDateAndDayPart(key.sectionId(), key.windowDate(), key.dayPart());

        List<MatchSquadMemberDto> selected = matchSquadMemberRepository
                .findByMatchIdAndTeamId(match.getId(), team.getId()).stream()
                .map(this::toMemberDto)
                .toList();

        List<MatchSquadCandidateDto> candidates = new ArrayList<>();
        if (windowOpt.isPresent()) {
            SectionAvailabilityWindow window = windowOpt.get();
            Map<UUID, AvailabilityStatus> statusByPlayerId =
                    sectionAvailabilityResponseRepository.findByWindowId(window.getId()).stream()
                            .collect(Collectors.toMap(
                                    SectionAvailabilityResponse::getPlayerProfileId,
                                    SectionAvailabilityResponse::getStatus));
            for (Map.Entry<UUID, AvailabilityStatus> entry : statusByPlayerId.entrySet()) {
                if (entry.getValue() != AvailabilityStatus.AVAILABLE) {
                    continue;
                }
                UUID playerId = entry.getKey();
                PlayerProfile profile = playerProfileRepository.findById(playerId).orElse(null);
                if (profile == null) {
                    continue;
                }
                Person person = personRepository.findById(profile.getPersonId()).orElse(null);
                if (person == null) {
                    continue;
                }
                MatchSquadPickedElsewhereDto pickedElsewhere = matchSquadMemberRepository
                        .findBySectionAvailabilityWindowIdAndPlayerProfileId(window.getId(), playerId)
                        .filter(existing -> !(existing.getMatchId().equals(match.getId())
                                && existing.getTeamId().equals(team.getId())))
                        .map(existing -> new MatchSquadPickedElsewhereDto(
                                existing.getMatchId(),
                                existing.getTeamId(),
                                teamRepository.findById(existing.getTeamId()).map(Team::getName).orElse(null)))
                        .orElse(null);
                candidates.add(new MatchSquadCandidateDto(
                        playerId, person.getFirstName(), person.getLastName(), profile.getJerseyNumber(), pickedElsewhere));
            }
        }
        candidates.sort(Comparator.comparing(MatchSquadCandidateDto::lastName)
                .thenComparing(MatchSquadCandidateDto::firstName));

        return new MatchSquadDto(
                key.sectionId(),
                key.windowDate(),
                key.dayPart(),
                windowOpt.map(SectionAvailabilityWindow::getId).orElse(null),
                windowOpt.map(SectionAvailabilityWindow::isOpen).orElse(false),
                windowOpt.map(SectionAvailabilityWindow::getRoundId).orElse(null),
                candidates,
                selected);
    }

    private MatchSquadMemberDto toMemberDto(MatchSquadMember member) {
        PlayerProfile profile = playerProfileRepository
                .findById(member.getPlayerProfileId())
                .orElseThrow(() -> new NotFoundException("Player not found: " + member.getPlayerProfileId()));
        Person person = personRepository
                .findById(profile.getPersonId())
                .orElseThrow(() -> new NotFoundException("Person not found: " + profile.getPersonId()));
        List<UUID> sectionIds = playerSectionRepository.findByPlayerProfileId(profile.getId()).stream()
                .map(PlayerSection::getSectionId)
                .toList();
        return playerMapper.toMatchSquadMemberDto(person, profile, member, sectionIds);
    }

    private Match findMatchOrThrowForClub(UUID clubId, UUID matchId) {
        Match match = matchRepository
                .findById(matchId)
                .orElseThrow(() -> new NotFoundException("Match not found: " + matchId));
        if (!match.getClubId().equals(clubId)) {
            throw new NotFoundException("Match not found: " + matchId);
        }
        return match;
    }

    private Team findTeamOrThrowForMatchSide(UUID clubId, Match match, UUID teamId) {
        boolean isHome = teamId.equals(match.getHomeTeamId());
        boolean isAway = teamId.equals(match.getAwayTeamId());
        if (!isHome && !isAway) {
            throw new ValidationException(
                    "teamId " + teamId + " is not one of this match's own home/away team ids");
        }
        Team team = teamRepository.findById(teamId).orElseThrow(() -> new NotFoundException("Team not found: " + teamId));
        if (!team.getClubId().equals(clubId)) {
            throw new NotFoundException("Team not found: " + teamId);
        }
        return team;
    }

    private PlayerProfile findActivePlayerOrThrowForClub(UUID clubId, UUID playerId) {
        PlayerProfile profile = playerProfileRepository
                .findById(playerId)
                .orElseThrow(() -> new NotFoundException("Player not found: " + playerId));
        if (!profile.getClubId().equals(clubId) || !profile.isActive()) {
            throw new NotFoundException("Player not found: " + playerId);
        }
        return profile;
    }
}
