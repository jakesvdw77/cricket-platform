package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.ManagerOverviewDto;
import com.cricketlegend.dto.OverviewMatchDto;
import com.cricketlegend.dto.OverviewMatchSideDto;
import com.cricketlegend.dto.OverviewPollDto;
import com.cricketlegend.dto.OverviewQuickActionsDto;
import com.cricketlegend.dto.SelectionLimitsDto;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.MatchSpecifications;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.ManagerOverviewService;
import com.cricketlegend.service.support.MatchSideNames;
import com.cricketlegend.service.support.OverviewPolls;
import com.cricketlegend.service.support.SelectionLimitsResolver;
import com.cricketlegend.service.support.ServerClock;
import java.time.Instant;
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
import java.util.stream.Collectors;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/079-manager-shell-and-overview.md. Scope is {@link AccessService#accessibleSectionIds}
 * (empty Optional is unrestricted) applied to matches through the same {@link
 * MatchSpecifications#forList} composition {@code MatchServiceImpl.list} uses, to polls by {@link
 * OverviewPolls}, and to players by section tag. For a restricted caller an own-club side counts
 * (selected, announced, not announced) only when its team's section is one the caller administers,
 * so a derby between two sections shows each manager just his own side. One query per kind of data,
 * whatever the number of matches: week matches, upcoming matches, teams, sides, selected players,
 * league limits, polls, player count.
 */
@Service
public class ManagerOverviewServiceImpl implements ManagerOverviewService {

    static final int UPCOMING_LIMIT = 5;
    static final int OPEN_POLLS_LIMIT = 5;
    static final int WEEK_DAYS = 7;

    private final MatchRepository matchRepository;
    private final MatchSideRepository matchSideRepository;
    private final MatchSidePlayerRepository matchSidePlayerRepository;
    private final TeamRepository teamRepository;
    private final PlayerProfileRepository playerProfileRepository;
    private final PlayerSectionRepository playerSectionRepository;
    private final SelectionLimitsResolver selectionLimitsResolver;
    private final OverviewPolls overviewPolls;
    private final AccessService accessService;

    public ManagerOverviewServiceImpl(
            MatchRepository matchRepository,
            MatchSideRepository matchSideRepository,
            MatchSidePlayerRepository matchSidePlayerRepository,
            TeamRepository teamRepository,
            PlayerProfileRepository playerProfileRepository,
            PlayerSectionRepository playerSectionRepository,
            SelectionLimitsResolver selectionLimitsResolver,
            OverviewPolls overviewPolls,
            AccessService accessService) {
        this.matchRepository = matchRepository;
        this.matchSideRepository = matchSideRepository;
        this.matchSidePlayerRepository = matchSidePlayerRepository;
        this.teamRepository = teamRepository;
        this.playerProfileRepository = playerProfileRepository;
        this.playerSectionRepository = playerSectionRepository;
        this.selectionLimitsResolver = selectionLimitsResolver;
        this.overviewPolls = overviewPolls;
        this.accessService = accessService;
    }

    @Override
    @Transactional(readOnly = true)
    public ManagerOverviewDto overview(Authentication authentication, UUID clubId) {
        Optional<Set<UUID>> accessible = accessService.accessibleSectionIds(authentication, clubId);
        OverviewQuickActionsDto quickActions = quickActions(authentication, clubId);
        if (accessible.isPresent() && accessible.get().isEmpty()) {
            return new ManagerOverviewDto(0, 0, 0, 0, List.of(), List.of(), List.of(), quickActions);
        }

        Instant weekStart = ServerClock.startOfToday();
        Instant weekEnd = ServerClock.startOfDayFromToday(WEEK_DAYS);
        Specification<Match> upcomingSpec = MatchSpecifications.forList(clubId, accessible, null, null, null, null)
                .and(MatchSpecifications.active())
                .and(MatchSpecifications.matchDateOnOrAfter(weekStart));
        // The window is also enforced here, on the half-open [weekStart, weekEnd) rule, so the
        // boundary is one documented rule and not only a database predicate.
        List<Match> weekMatches = matchRepository
                .findAll(upcomingSpec.and(MatchSpecifications.matchDateBefore(weekEnd)))
                .stream()
                .filter(match -> !match.getMatchDate().isBefore(weekStart) && match.getMatchDate().isBefore(weekEnd))
                .toList();
        // A fluent query with a limit, not a Page: a Page adds a count query once the page is full,
        // which would make the statement count depend on the data.
        List<Match> upcoming = matchRepository.findBy(
                upcomingSpec, query -> query.sortBy(Sort.by("matchDate", "id")).limit(UPCOMING_LIMIT).all());

        Map<UUID, Match> matchesById = new HashMap<>();
        weekMatches.forEach(match -> matchesById.put(match.getId(), match));
        upcoming.forEach(match -> matchesById.put(match.getId(), match));
        Map<UUID, Team> teamsById = loadTeams(matchesById.values());
        Map<String, MatchSide> sideByKey = loadSides(matchesById.keySet());
        Map<UUID, Long> selectedBySideId = loadSelectedCounts(sideByKey.values());
        Map<SelectionLimitsResolver.LeagueSeason, SelectionLimitsDto> limits = selectionLimitsResolver.limitsFor(
                matchesById.values().stream()
                        .filter(match -> match.getLeagueId() != null)
                        .map(match -> new SelectionLimitsResolver.LeagueSeason(match.getLeagueId(), match.getSeasonId()))
                        .collect(Collectors.toSet()));

        Map<UUID, List<OverviewMatchSideDto>> sidesByMatchId = new HashMap<>();
        Map<UUID, UUID> sectionByMatchId = new HashMap<>();
        for (Match match : matchesById.values()) {
            List<OverviewMatchSideDto> sides = new ArrayList<>();
            for (UUID teamId : sideTeamIds(match)) {
                Team team = teamsById.get(teamId);
                if (!isReachableOwnTeam(team, clubId, accessible)) {
                    continue;
                }
                sectionByMatchId.putIfAbsent(match.getId(), team.getSectionId());
                sides.add(toSide(match, team, sideByKey, selectedBySideId, limits));
            }
            sidesByMatchId.put(match.getId(), sides);
        }

        int teamsNotAnnounced = (int) weekMatches.stream()
                .flatMap(match -> sidesByMatchId.get(match.getId()).stream())
                .filter(side -> !side.announced())
                .count();
        List<OverviewMatchDto> upcomingDtos = upcoming.stream()
                .map(match -> new OverviewMatchDto(
                        match.getId(),
                        match.getMatchDate(),
                        match.getVenue(),
                        match.getHomeTeamId(),
                        MatchSideNames.home(match, teamsById),
                        match.getAwayTeamId(),
                        MatchSideNames.away(match, teamsById),
                        sectionByMatchId.get(match.getId()),
                        sidesByMatchId.get(match.getId())))
                .toList();

        List<OverviewPollDto> polls = overviewPolls.openPolls(clubId, accessible);
        long answersAwaited = polls.stream()
                .mapToLong(poll -> Math.max(0, poll.totalCount() - poll.repliedCount()))
                .sum();
        List<OverviewPollDto> openPolls = polls.stream()
                .sorted(Comparator.comparing(OverviewPollDto::scheduledCloseAt, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(OverviewPollDto::title)
                        .thenComparing(OverviewPollDto::id))
                .limit(OPEN_POLLS_LIMIT)
                .toList();

        return new ManagerOverviewDto(
                weekMatches.size(),
                teamsNotAnnounced,
                answersAwaited,
                activePlayers(clubId, accessible),
                upcomingDtos,
                openPolls,
                List.of(),
                quickActions);
    }

    /**
     * Every quick action mirrors the guard of the endpoint behind it: match create, squad poll
     * create, group poll create and player create are all {@code canAccessClub} (the per-resource
     * section check happens inside each create); Communication is a placeholder, so messageSquad
     * uses the same gate. One access lookup serves all four.
     */
    private OverviewQuickActionsDto quickActions(Authentication authentication, UUID clubId) {
        boolean allowed = accessService.canAccessClub(authentication, clubId);
        return new OverviewQuickActionsDto(allowed, allowed, allowed, allowed);
    }

    private Map<UUID, Team> loadTeams(Collection<Match> matches) {
        Set<UUID> teamIds = new HashSet<>();
        for (Match match : matches) {
            teamIds.addAll(sideTeamIds(match));
        }
        if (teamIds.isEmpty()) {
            return Map.of();
        }
        return teamRepository.findAllById(teamIds).stream()
                .collect(Collectors.toMap(Team::getId, team -> team));
    }

    /** The home then away team id of a match, skipping a free-text side. */
    private List<UUID> sideTeamIds(Match match) {
        List<UUID> ids = new ArrayList<>(2);
        if (match.getHomeTeamId() != null) {
            ids.add(match.getHomeTeamId());
        }
        if (match.getAwayTeamId() != null) {
            ids.add(match.getAwayTeamId());
        }
        return ids;
    }

    /** Side rows keyed {@code matchId|teamId} (as a string, the match list's own key shape). */
    private Map<String, MatchSide> loadSides(Set<UUID> matchIds) {
        if (matchIds.isEmpty()) {
            return Map.of();
        }
        return matchSideRepository.findByMatchIdIn(matchIds).stream()
                .collect(Collectors.toMap(side -> sideKey(side.getMatchId(), side.getTeamId()), side -> side));
    }

    private Map<UUID, Long> loadSelectedCounts(Collection<MatchSide> sides) {
        if (sides.isEmpty()) {
            return Map.of();
        }
        Map<UUID, Long> counts = new HashMap<>();
        for (MatchSidePlayer row : matchSidePlayerRepository.findByMatchSideIdIn(
                sides.stream().map(MatchSide::getId).toList())) {
            counts.merge(row.getMatchSideId(), 1L, Long::sum);
        }
        return counts;
    }

    private boolean isReachableOwnTeam(Team team, UUID clubId, Optional<Set<UUID>> accessible) {
        return team != null
                && clubId.equals(team.getClubId())
                && (accessible.isEmpty() || accessible.get().contains(team.getSectionId()));
    }

    private OverviewMatchSideDto toSide(
            Match match,
            Team team,
            Map<String, MatchSide> sideByKey,
            Map<UUID, Long> selectedBySideId,
            Map<SelectionLimitsResolver.LeagueSeason, SelectionLimitsDto> limits) {
        MatchSide side = sideByKey.get(sideKey(match.getId(), team.getId()));
        int selected = side == null ? 0 : selectedBySideId.getOrDefault(side.getId(), 0L).intValue();
        return new OverviewMatchSideDto(
                team.getId(), team.getName(), selected, maxSelected(match, limits), side != null && side.isAnnounced());
    }

    /** 076's places plus 12th man: a friendly needs no lookup, a league match reads the batched limits. */
    private Integer maxSelected(
            Match match, Map<SelectionLimitsResolver.LeagueSeason, SelectionLimitsDto> limits) {
        if (match.getLeagueId() == null) {
            return selectionLimitsResolver.limits(match).maxSelected();
        }
        SelectionLimitsDto found =
                limits.get(new SelectionLimitsResolver.LeagueSeason(match.getLeagueId(), match.getSeasonId()));
        return found == null ? null : found.maxSelected();
    }

    private String sideKey(UUID matchId, UUID teamId) {
        return matchId + "|" + teamId;
    }

    private long activePlayers(UUID clubId, Optional<Set<UUID>> accessible) {
        if (accessible.isEmpty()) {
            return playerProfileRepository.countByClubIdAndActiveTrue(clubId);
        }
        Set<UUID> taggedIds = playerSectionRepository.findBySectionIdIn(accessible.get()).stream()
                .map(PlayerSection::getPlayerProfileId)
                .collect(Collectors.toSet());
        if (taggedIds.isEmpty()) {
            return 0;
        }
        return playerProfileRepository.countByClubIdAndActiveTrueAndIdIn(clubId, taggedIds);
    }
}
