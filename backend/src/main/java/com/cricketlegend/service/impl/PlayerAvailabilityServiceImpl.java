package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AvailabilityPollType;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.PlayerAvailabilityCellStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.SectionAvailabilityWindowMatch;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.dto.CellDto;
import com.cricketlegend.dto.GameColumnDto;
import com.cricketlegend.dto.PlayerAvailabilityDto;
import com.cricketlegend.dto.PlayerRowDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.MatchSpecifications;
import com.cricketlegend.repository.MatchSquadMemberRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.PlayerAvailabilityService;
import com.cricketlegend.service.SectionAvailabilityMatchResolver;
import com.cricketlegend.service.support.ServerClock;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Per docs/specs/068-player-availability-grid.md: assembles the season availability grid by hand
 * (precedent: {@code MatchAvailabilityPollServiceImpl.buildResponsesDto}) from one batched query
 * per entity — never the per-poll/per-window resolvers ({@code AvailabilityPollSquadResolver},
 * {@code SectionAvailabilityAudienceResolver}, {@code MatchPollCoverageService}), which are N+1
 * by construction. Same data and audience rules as those resolvers: a game linked to a group
 * window ({@code SectionAvailabilityWindowMatch}) is covered by that group poll (a match is in at
 * most one poll, docs/specs/064); otherwise a squad poll for this club's team in the game covers
 * it; otherwise there is no poll. "Picked" is membership of the game's {@code MatchSquadMember}
 * set or of any {@code MatchSide}'s {@code MatchSidePlayer} selection, regardless of whether the
 * team sheet is announced.
 *
 * <p>Jersey numbers: with a Team filter the row shows the squad number the squad poll screens show
 * ({@code TeamSquadMember.jerseyNumber}, from the latest game's season that has one), falling back
 * to {@code PlayerProfile.jerseyNumber}; without a Team filter it is {@code
 * PlayerProfile.jerseyNumber}, as the group poll audience does. A Team filter also derives the
 * scope from that team's own section; combined with a {@code sectionId} that does not contain the
 * team it yields an empty grid.
 */
@Service
public class PlayerAvailabilityServiceImpl implements PlayerAvailabilityService {

    /**
     * Hard cap on the games (columns) of one response: the soonest 150 games matching the filters
     * (all upcoming), or, with {@code includePast}, the LATEST 150 (upcoming games are what the
     * grid is for), always shown in ascending date order (ties broken by id). A season of one
     * section is tens of games, so hitting this means the filters are too wide. Sets {@code
     * truncated} on the response.
     */
    public static final int MAX_GAMES = 150;

    /**
     * Hard cap on the players (rows) of one response, kept in first-name-then-last-name order (as the grid displays names); a section is hundreds
     * of players at most. Sets {@code truncated} on the response.
     */
    public static final int MAX_PLAYERS = 500;

    private final MatchRepository matchRepository;
    private final TeamRepository teamRepository;
    private final SectionRepository sectionRepository;
    private final LeagueRepository leagueRepository;
    private final SectionAvailabilityWindowMatchRepository windowMatchRepository;
    private final SectionAvailabilityWindowRepository windowRepository;
    private final SectionAvailabilityResponseRepository responseRepository;
    private final MatchAvailabilityPollRepository pollRepository;
    private final PlayerAvailabilityRepository playerAvailabilityRepository;
    private final MatchSquadMemberRepository matchSquadMemberRepository;
    private final MatchSideRepository matchSideRepository;
    private final MatchSidePlayerRepository matchSidePlayerRepository;
    private final TeamSquadMemberRepository teamSquadMemberRepository;
    private final PlayerSectionRepository playerSectionRepository;
    private final PlayerProfileRepository playerProfileRepository;
    private final PersonRepository personRepository;
    private final AccessService accessService;
    private final SectionAvailabilityMatchResolver matchResolver;

    public PlayerAvailabilityServiceImpl(
            MatchRepository matchRepository,
            TeamRepository teamRepository,
            SectionRepository sectionRepository,
            LeagueRepository leagueRepository,
            SectionAvailabilityWindowMatchRepository windowMatchRepository,
            SectionAvailabilityWindowRepository windowRepository,
            SectionAvailabilityResponseRepository responseRepository,
            MatchAvailabilityPollRepository pollRepository,
            PlayerAvailabilityRepository playerAvailabilityRepository,
            MatchSquadMemberRepository matchSquadMemberRepository,
            MatchSideRepository matchSideRepository,
            MatchSidePlayerRepository matchSidePlayerRepository,
            TeamSquadMemberRepository teamSquadMemberRepository,
            PlayerSectionRepository playerSectionRepository,
            PlayerProfileRepository playerProfileRepository,
            PersonRepository personRepository,
            AccessService accessService,
            SectionAvailabilityMatchResolver matchResolver) {
        this.matchRepository = matchRepository;
        this.teamRepository = teamRepository;
        this.sectionRepository = sectionRepository;
        this.leagueRepository = leagueRepository;
        this.windowMatchRepository = windowMatchRepository;
        this.windowRepository = windowRepository;
        this.responseRepository = responseRepository;
        this.pollRepository = pollRepository;
        this.playerAvailabilityRepository = playerAvailabilityRepository;
        this.matchSquadMemberRepository = matchSquadMemberRepository;
        this.matchSideRepository = matchSideRepository;
        this.matchSidePlayerRepository = matchSidePlayerRepository;
        this.teamSquadMemberRepository = teamSquadMemberRepository;
        this.playerSectionRepository = playerSectionRepository;
        this.playerProfileRepository = playerProfileRepository;
        this.personRepository = personRepository;
        this.accessService = accessService;
        this.matchResolver = matchResolver;
    }

    @Override
    @Transactional(readOnly = true)
    public PlayerAvailabilityDto getGrid(
            Authentication authentication,
            UUID clubId,
            UUID seasonId,
            UUID leagueId,
            UUID sectionId,
            UUID teamId,
            boolean includePast) {
        // null scope = unrestricted (club-wide caller, no section narrowing): no section filtering.
        Set<UUID> scope = resolveScope(authentication, clubId, sectionId);
        Team teamFilter = resolveTeamFilter(authentication, clubId, teamId);
        if (teamFilter != null) {
            // A chosen team defines the scope (its own section); a sectionId that does not contain
            // the team (after the access checks) means nothing can match.
            if (sectionId != null && !scope.contains(teamFilter.getSectionId())) {
                return emptyGrid();
            }
            scope = Set.of(teamFilter.getSectionId());
        }
        if (scope != null && scope.isEmpty()) {
            return emptyGrid();
        }

        List<Match> found = findGames(clubId, seasonId, leagueId, scope, teamId, includePast);
        boolean truncated = found.size() > MAX_GAMES;
        List<Match> matches = new ArrayList<>(truncated ? found.subList(0, MAX_GAMES) : found);
        if (includePast) {
            // Fetched latest-first so the cap keeps the latest games; shown ascending.
            java.util.Collections.reverse(matches);
        }
        if (matches.isEmpty()) {
            return emptyGrid();
        }

        Set<UUID> matchIds = matches.stream().map(Match::getId).collect(Collectors.toSet());
        Set<UUID> seasonIds = matches.stream().map(Match::getSeasonId).collect(Collectors.toSet());

        // Teams (one batch, includes opponents' teams for the label) and the game's own team.
        Set<UUID> teamIds = new HashSet<>();
        for (Match match : matches) {
            addIfNotNull(teamIds, match.getHomeTeamId());
            addIfNotNull(teamIds, match.getAwayTeamId());
        }
        Map<UUID, Team> teamsById = indexById(teamRepository.findAllById(teamIds), Team::getId);
        Map<UUID, Team> ownTeamByMatch = new HashMap<>();
        for (Match match : matches) {
            Team own = ownTeamInGame(match, clubId, scope, teamId, teamsById);
            if (own != null) {
                ownTeamByMatch.put(match.getId(), own);
            }
        }

        // Group coverage: window links -> windows.
        Map<UUID, UUID> windowIdByMatch = new HashMap<>();
        for (SectionAvailabilityWindowMatch link : windowMatchRepository.findByMatchIdIn(matchIds)) {
            windowIdByMatch.put(link.getMatchId(), link.getWindowId());
        }
        Map<UUID, SectionAvailabilityWindow> windowsById = indexById(
                windowRepository.findAllById(new HashSet<>(windowIdByMatch.values())),
                SectionAvailabilityWindow::getId);

        // Squad polls: only count a poll for this club's team in the game.
        Map<UUID, MatchAvailabilityPoll> squadPollByMatch = new HashMap<>();
        for (MatchAvailabilityPoll poll : pollRepository.findByMatchIdIn(matchIds)) {
            Team own = ownTeamByMatch.get(poll.getMatchId());
            if (own != null && own.getId().equals(poll.getTeamId())) {
                squadPollByMatch.put(poll.getMatchId(), poll);
            }
        }

        // Answers.
        Map<UUID, Map<UUID, AvailabilityStatus>> groupAnswers = new HashMap<>();
        for (SectionAvailabilityResponse response : responseRepository.findByWindowIdIn(windowsById.keySet())) {
            groupAnswers
                    .computeIfAbsent(response.getWindowId(), key -> new HashMap<>())
                    .put(response.getPlayerProfileId(), response.getStatus());
        }
        Set<UUID> pollIds = squadPollByMatch.values().stream()
                .map(MatchAvailabilityPoll::getId)
                .collect(Collectors.toSet());
        Map<UUID, Map<UUID, AvailabilityStatus>> squadAnswers = new HashMap<>();
        for (PlayerAvailability answer : playerAvailabilityRepository.findByPollIdIn(pollIds)) {
            if (answer.getStatus() != null) {
                squadAnswers
                        .computeIfAbsent(answer.getPollId(), key -> new HashMap<>())
                        .put(answer.getPlayerProfileId(), answer.getStatus());
            }
        }

        Map<UUID, Set<UUID>> pickedByMatch = loadPicked(matchIds);

        // Audiences.
        Map<UUID, Set<UUID>> descendantsByWindowSection = new HashMap<>();
        for (SectionAvailabilityWindow window : windowsById.values()) {
            descendantsByWindowSection.computeIfAbsent(
                    window.getSectionId(), id -> accessService.sectionAndDescendantIds(clubId, id));
        }
        Set<UUID> rowSectionIds = teamFilter != null ? Set.of() : rowSectionIds(clubId, scope);
        Set<UUID> sectionIdsToLoad = new HashSet<>(rowSectionIds);
        descendantsByWindowSection.values().forEach(sectionIdsToLoad::addAll);
        Map<UUID, Set<UUID>> playersBySection = new HashMap<>();
        Set<UUID> sectionPlayerIds = new HashSet<>();
        for (PlayerSection playerSection : playerSectionRepository.findBySectionIdIn(sectionIdsToLoad)) {
            playersBySection
                    .computeIfAbsent(playerSection.getSectionId(), key -> new HashSet<>())
                    .add(playerSection.getPlayerProfileId());
            sectionPlayerIds.add(playerSection.getPlayerProfileId());
        }

        Set<UUID> squadTeamIds = ownTeamByMatch.values().stream().map(Team::getId).collect(Collectors.toSet());
        Map<String, Set<UUID>> squadByTeamSeason = new HashMap<>();
        Map<String, Map<UUID, Integer>> squadJerseyByTeamSeason = new HashMap<>();
        for (TeamSquadMember member : teamSquadMemberRepository.findByTeamIdInAndSeasonIdIn(squadTeamIds, seasonIds)) {
            if (member.getJerseyNumber() != null) {
                squadJerseyByTeamSeason
                        .computeIfAbsent(member.getTeamId() + "|" + member.getSeasonId(), key -> new HashMap<>())
                        .put(member.getPlayerProfileId(), member.getJerseyNumber());
            }
            squadByTeamSeason
                    .computeIfAbsent(member.getTeamId() + "|" + member.getSeasonId(), key -> new HashSet<>())
                    .add(member.getPlayerProfileId());
        }

        // Row candidates and profiles/names.
        Set<UUID> candidateIds = new HashSet<>();
        if (teamFilter != null) {
            for (UUID season : seasonIds) {
                candidateIds.addAll(squadByTeamSeason.getOrDefault(teamFilter.getId() + "|" + season, Set.of()));
            }
        } else {
            for (UUID section : rowSectionIds) {
                candidateIds.addAll(playersBySection.getOrDefault(section, Set.of()));
            }
        }
        Set<UUID> profileIdsToLoad = new HashSet<>(candidateIds);
        profileIdsToLoad.addAll(sectionPlayerIds);
        Map<UUID, PlayerProfile> profiles =
                indexById(playerProfileRepository.findAllById(profileIdsToLoad), PlayerProfile::getId);
        Map<UUID, Set<UUID>> audienceByWindow = new HashMap<>();
        for (SectionAvailabilityWindow window : windowsById.values()) {
            audienceByWindow.put(
                    window.getId(),
                    groupAudience(
                            descendantsByWindowSection.getOrDefault(window.getSectionId(), Set.of()),
                            playersBySection,
                            profiles));
        }
        Set<UUID> personIds = candidateIds.stream()
                .map(profiles::get)
                .filter(profile -> profile != null)
                .map(PlayerProfile::getPersonId)
                .collect(Collectors.toSet());
        Map<UUID, Person> persons = indexById(personRepository.findAllById(personIds), Person::getId);

        List<UUID> rowOrder = candidateIds.stream()
                .filter(id -> {
                    PlayerProfile profile = profiles.get(id);
                    if (profile == null || persons.get(profile.getPersonId()) == null) {
                        return false;
                    }
                    // Section audiences are active-only; a chosen team's squad is as the poll shows it.
                    return teamFilter != null || profile.isActive();
                })
                .sorted(byName(profiles, persons))
                .toList();
        if (rowOrder.size() > MAX_PLAYERS) {
            truncated = true;
            rowOrder = rowOrder.subList(0, MAX_PLAYERS);
        }

        // Leagues for the column labels.
        Set<UUID> leagueIds = new HashSet<>();
        for (Match match : matches) {
            addIfNotNull(leagueIds, match.getLeagueId());
        }
        Map<UUID, League> leaguesById = indexById(leagueRepository.findAllById(leagueIds), League::getId);

        // Columns.
        List<GameColumnDto> games = new ArrayList<>();
        for (Match match : matches) {
            games.add(toColumn(
                    match,
                    teamsById,
                    ownTeamByMatch.get(match.getId()),
                    windowsById.get(windowIdByMatch.get(match.getId())),
                    squadPollByMatch.get(match.getId()),
                    leaguesById));
        }

        // Rows.
        List<PlayerRowDto> players = new ArrayList<>();
        for (UUID playerId : rowOrder) {
            PlayerProfile profile = profiles.get(playerId);
            Person person = persons.get(profile.getPersonId());
            List<CellDto> cells = new ArrayList<>();
            int answered = 0;
            int picked = 0;
            for (Match match : matches) {
                SectionAvailabilityWindow window = windowsById.get(windowIdByMatch.get(match.getId()));
                MatchAvailabilityPoll poll = squadPollByMatch.get(match.getId());
                PlayerAvailabilityCellStatus status;
                if (window != null) {
                    status = cellStatus(
                            audienceByWindow.get(window.getId()).contains(playerId),
                            groupAnswers.getOrDefault(window.getId(), Map.of()).get(playerId));
                } else if (poll != null) {
                    Set<UUID> squad = squadByTeamSeason.getOrDefault(
                            poll.getTeamId() + "|" + match.getSeasonId(), Set.of());
                    status = cellStatus(
                            squad.contains(playerId),
                            squadAnswers.getOrDefault(poll.getId(), Map.of()).get(playerId));
                } else {
                    status = PlayerAvailabilityCellStatus.NOT_IN_POLL;
                }
                boolean isPicked = pickedByMatch.getOrDefault(match.getId(), Set.of()).contains(playerId);
                if (isAnswered(status)) {
                    answered++;
                }
                if (isPicked) {
                    picked++;
                }
                cells.add(new CellDto(match.getId(), status, isPicked));
            }
            players.add(new PlayerRowDto(
                    playerId, person.getFirstName(), person.getLastName(), jerseyFor(teamFilter, playerId, profile, matches, squadJerseyByTeamSeason),
                    answered, picked, cells));
        }
        return new PlayerAvailabilityDto(games, players, truncated);
    }

    /** Squad number (latest game's season first) under a Team filter, else the profile's number. */
    private static Integer jerseyFor(
            Team teamFilter,
            UUID playerId,
            PlayerProfile profile,
            List<Match> matches,
            Map<String, Map<UUID, Integer>> squadJerseyByTeamSeason) {
        if (teamFilter != null) {
            for (int i = matches.size() - 1; i >= 0; i--) {
                Integer squadNumber = squadJerseyByTeamSeason
                        .getOrDefault(teamFilter.getId() + "|" + matches.get(i).getSeasonId(), Map.of())
                        .get(playerId);
                if (squadNumber != null) {
                    return squadNumber;
                }
            }
        }
        return profile.getJerseyNumber();
    }

    private static PlayerAvailabilityDto emptyGrid() {
        return new PlayerAvailabilityDto(List.of(), List.of(), false);
    }

    /**
     * Same scope rules as {@code MatchAvailabilityPollServiceImpl.listScopedPolls}: the caller's
     * accessible sections, narrowed to the (validated) {@code sectionId}'s closure. {@code null}
     * means unrestricted.
     */
    private Set<UUID> resolveScope(Authentication authentication, UUID clubId, UUID sectionId) {
        Optional<Set<UUID>> accessible = accessService.accessibleSectionIds(authentication, clubId);
        Set<UUID> narrowTo = null;
        if (sectionId != null) {
            accessService.assertCanAdministerSection(authentication, clubId, sectionId);
            narrowTo = accessService.sectionAndDescendantIds(clubId, sectionId);
        }
        if (accessible.isEmpty()) {
            return narrowTo;
        }
        if (narrowTo == null) {
            return accessible.get();
        }
        Set<UUID> intersection = new HashSet<>(narrowTo);
        intersection.retainAll(accessible.get());
        return intersection;
    }

    /** 404 for a team that is not this club's, 403 for a team whose section the caller cannot reach. */
    private Team resolveTeamFilter(Authentication authentication, UUID clubId, UUID teamId) {
        if (teamId == null) {
            return null;
        }
        Team team = teamRepository
                .findById(teamId)
                .filter(candidate -> clubId.equals(candidate.getClubId()))
                .orElseThrow(() -> new NotFoundException("Team not found: " + teamId));
        accessService.assertCanAdministerSection(authentication, clubId, team.getSectionId());
        return team;
    }

    private List<Match> findGames(
            UUID clubId, UUID seasonId, UUID leagueId, Set<UUID> scope, UUID teamId, boolean includePast) {
        Specification<Match> spec = Specification.where(MatchSpecifications.clubId(clubId));
        if (scope != null) {
            spec = spec.and(MatchSpecifications.sectionIn(scope));
        }
        if (leagueId != null) {
            spec = spec.and(MatchSpecifications.leagueIdEquals(leagueId));
        }
        if (seasonId != null) {
            spec = spec.and(MatchSpecifications.seasonIdEquals(seasonId));
        }
        if (teamId != null) {
            spec = spec.and(MatchSpecifications.teamIdEquals(teamId));
        }
        if (!includePast) {
            spec = spec.and(MatchSpecifications.matchDateOnOrAfter(ServerClock.startOfToday()));
        }
        // One extra row tells us whether the cap cut anything. Without includePast every game is
        // upcoming, so keep the earliest; with it, keep the latest (the caller reverses to ascending).
        Sort sort = includePast
                ? Sort.by(Sort.Order.desc("matchDate"), Sort.Order.desc("id"))
                : Sort.by(Sort.Order.asc("matchDate"), Sort.Order.asc("id"));
        return matchRepository.findAll(spec, PageRequest.of(0, MAX_GAMES + 1, sort)).getContent();
    }

    /** This club's team in the game that lies in scope (and is the chosen team, when one is chosen). */
    private Team ownTeamInGame(Match match, UUID clubId, Set<UUID> scope, UUID teamId, Map<UUID, Team> teamsById) {
        for (UUID candidateId : new UUID[] {match.getHomeTeamId(), match.getAwayTeamId()}) {
            Team team = candidateId == null ? null : teamsById.get(candidateId);
            if (team != null
                    && clubId.equals(team.getClubId())
                    && (scope == null || scope.contains(team.getSectionId()))
                    && (teamId == null || teamId.equals(team.getId()))) {
                return team;
            }
        }
        return null;
    }

    /** Sections whose members are the rows when no team is chosen: the scope, or every club section. */
    private Set<UUID> rowSectionIds(UUID clubId, Set<UUID> scope) {
        if (scope != null) {
            return scope;
        }
        return sectionRepository.findByClubId(clubId).stream().map(Section::getId).collect(Collectors.toSet());
    }

    /** Picked = in the game's MatchSquadMember set or in any of its MatchSide selections. */
    private Map<UUID, Set<UUID>> loadPicked(Set<UUID> matchIds) {
        Map<UUID, Set<UUID>> pickedByMatch = new HashMap<>();
        matchSquadMemberRepository.findByMatchIdIn(matchIds).forEach(member -> pickedByMatch
                .computeIfAbsent(member.getMatchId(), key -> new HashSet<>())
                .add(member.getPlayerProfileId()));
        Map<UUID, UUID> matchIdBySideId = new HashMap<>();
        for (MatchSide side : matchSideRepository.findByMatchIdIn(matchIds)) {
            matchIdBySideId.put(side.getId(), side.getMatchId());
        }
        matchSidePlayerRepository.findByMatchSideIdIn(matchIdBySideId.keySet()).forEach(player -> pickedByMatch
                .computeIfAbsent(matchIdBySideId.get(player.getMatchSideId()), key -> new HashSet<>())
                .add(player.getPlayerProfileId()));
        return pickedByMatch;
    }

    private GameColumnDto toColumn(
            Match match,
            Map<UUID, Team> teamsById,
            Team ownTeam,
            SectionAvailabilityWindow window,
            MatchAvailabilityPoll squadPoll,
            Map<UUID, League> leaguesById) {
        AvailabilityPollType pollType = null;
        UUID pollId = null;
        UUID roundId = null;
        DayPart dayPart;
        if (window != null) {
            pollType = AvailabilityPollType.GROUP;
            pollId = window.getRoundId();
            roundId = window.getRoundId();
            dayPart = window.getDayPart();
        } else {
            dayPart = matchResolver.dayPartOf(match.getMatchDate());
            if (squadPoll != null) {
                pollType = AvailabilityPollType.SQUAD;
                pollId = squadPoll.getId();
            }
        }
        League league = match.getLeagueId() == null ? null : leaguesById.get(match.getLeagueId());
        String label = sideName(match.getHomeTeamId(), match.getHomeTeamName(), teamsById) + " v "
                + sideName(match.getAwayTeamId(), match.getAwayTeamName(), teamsById);
        return new GameColumnDto(
                match.getId(),
                match.getMatchDate(),
                dayPart,
                label,
                match.getVenue(),
                match.getLeagueId(),
                league == null ? null : league.getName(),
                ownTeam == null ? null : ownTeam.getId(),
                ownTeam == null ? null : ownTeam.getSectionId(),
                pollType,
                pollId,
                roundId);
    }

    private static String sideName(UUID teamId, String freeTextName, Map<UUID, Team> teamsById) {
        Team team = teamId == null ? null : teamsById.get(teamId);
        if (team != null) {
            return team.getName();
        }
        return freeTextName != null ? freeTextName : "TBC";
    }

    /** Group audience: active players tagged to the window's section or any descendant. */
    private static Set<UUID> groupAudience(
            Set<UUID> sectionIds, Map<UUID, Set<UUID>> playersBySection, Map<UUID, PlayerProfile> profiles) {
        Set<UUID> audience = new HashSet<>();
        for (UUID section : sectionIds) {
            for (UUID playerId : playersBySection.getOrDefault(section, Set.of())) {
                PlayerProfile profile = profiles.get(playerId);
                if (profile != null && profile.isActive()) {
                    audience.add(playerId);
                }
            }
        }
        return audience;
    }

    private static PlayerAvailabilityCellStatus cellStatus(boolean inAudience, AvailabilityStatus answer) {
        if (!inAudience) {
            return PlayerAvailabilityCellStatus.NOT_IN_POLL;
        }
        if (answer == null) {
            return PlayerAvailabilityCellStatus.NO_RESPONSE;
        }
        // The three answer names are shared with AvailabilityStatus (no switch: it would add a
        // synthetic nested class, which ArchUnit's service.impl rule rejects).
        return PlayerAvailabilityCellStatus.valueOf(answer.name());
    }

    private static boolean isAnswered(PlayerAvailabilityCellStatus status) {
        return status == PlayerAvailabilityCellStatus.AVAILABLE
                || status == PlayerAvailabilityCellStatus.UNSURE
                || status == PlayerAvailabilityCellStatus.UNAVAILABLE;
    }

    /**
     * Orders player profile ids by first name then last name (case-insensitive), matching the
     * "First Last" display, then by profile id as a stable tie-break.
     */
    private static Comparator<UUID> byName(Map<UUID, PlayerProfile> profiles, Map<UUID, Person> persons) {
        Function<UUID, Person> person = id -> persons.get(profiles.get(id).getPersonId());
        return Comparator.<UUID, String>comparing(id -> person.apply(id).getFirstName(), String.CASE_INSENSITIVE_ORDER)
                .thenComparing(id -> person.apply(id).getLastName(), String.CASE_INSENSITIVE_ORDER)
                .thenComparing(Function.identity());
    }

    private static <T> Map<UUID, T> indexById(Collection<T> entities, Function<T, UUID> idOf) {
        Map<UUID, T> byId = new HashMap<>();
        for (T entity : entities) {
            byId.put(idOf.apply(entity), entity);
        }
        return byId;
    }

    private static void addIfNotNull(Set<UUID> set, UUID id) {
        if (id != null) {
            set.add(id);
        }
    }
}
