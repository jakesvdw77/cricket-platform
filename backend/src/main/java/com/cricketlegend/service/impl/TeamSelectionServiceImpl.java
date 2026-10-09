package com.cricketlegend.service.impl;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.SelectionRejectionReason;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSelectionStatus;
import com.cricketlegend.dto.SelectionLimitsDto;
import com.cricketlegend.dto.TeamSelectionCellDto;
import com.cricketlegend.dto.TeamSelectionCountsDto;
import com.cricketlegend.dto.TeamSelectionMatchDto;
import com.cricketlegend.dto.TeamSelectionOverviewDto;
import com.cricketlegend.dto.TeamSelectionPickDto;
import com.cricketlegend.dto.TeamSelectionPlayerDto;
import com.cricketlegend.dto.TeamSelectionSideDto;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.SectionAvailabilityMatchResolver;
import com.cricketlegend.service.TeamSelectionService;
import com.cricketlegend.service.support.ClubMatchScope;
import com.cricketlegend.service.support.MatchSideNames;
import com.cricketlegend.service.support.SelectionEligibility;
import com.cricketlegend.service.support.SelectionLimitsResolver;
import com.cricketlegend.service.support.SelectionRejection;
import com.cricketlegend.service.support.SelectionRules;
import com.cricketlegend.service.support.ServerClock;
import com.cricketlegend.service.support.TeamSelectionBatchRules;
import com.cricketlegend.service.support.TeamSelectionBatchRules.MatchTeam;
import com.cricketlegend.service.support.TeamSelectionStatuses;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Per docs/specs/093-team-selection-hub.md: assembles the Team selection hub's data in a fixed
 * number of statements (one batched query per kind, never per match or per player). The picks come
 * from the matches' {@code MatchSide}/{@code MatchSidePlayer} rows; whether a player can be picked
 * comes from {@link TeamSelectionBatchRules}, which runs the very rules the apply endpoint runs
 * ({@code SelectionRules}), so a pickable cell is accepted by the apply endpoint and a blocked one
 * refused with the same reason. Rows are the players of the pools of the shown own sides plus
 * everyone picked; a derby between two teams of the club has two cells per player for that match.
 */
@Service
public class TeamSelectionServiceImpl implements TeamSelectionService {

    /** Hard cap on the matches of one response (as the player availability grid); sets {@code truncated}. */
    public static final int MAX_MATCHES = 150;

    /** Hard cap on the players (rows) of one response, in name order; sets {@code truncated}. */
    public static final int MAX_PLAYERS = 500;

    private final ClubMatchScope clubMatchScope;
    private final TeamRepository teamRepository;
    private final LeagueRepository leagueRepository;
    private final MatchSideRepository matchSideRepository;
    private final MatchSidePlayerRepository matchSidePlayerRepository;
    private final SelectionRules selectionRules;
    private final SelectionLimitsResolver limitsResolver;
    private final TeamSelectionBatchRules batchRules;
    private final SectionAvailabilityMatchResolver matchResolver;

    public TeamSelectionServiceImpl(
            ClubMatchScope clubMatchScope,
            TeamRepository teamRepository,
            LeagueRepository leagueRepository,
            MatchSideRepository matchSideRepository,
            MatchSidePlayerRepository matchSidePlayerRepository,
            SelectionRules selectionRules,
            SelectionLimitsResolver limitsResolver,
            TeamSelectionBatchRules batchRules,
            SectionAvailabilityMatchResolver matchResolver) {
        this.clubMatchScope = clubMatchScope;
        this.teamRepository = teamRepository;
        this.leagueRepository = leagueRepository;
        this.matchSideRepository = matchSideRepository;
        this.matchSidePlayerRepository = matchSidePlayerRepository;
        this.selectionRules = selectionRules;
        this.limitsResolver = limitsResolver;
        this.batchRules = batchRules;
        this.matchResolver = matchResolver;
    }

    @Override
    @Transactional(readOnly = true)
    public TeamSelectionOverviewDto overview(
            Authentication authentication,
            UUID clubId,
            UUID seasonId,
            UUID leagueId,
            UUID sectionId,
            UUID teamId,
            boolean includePast) {
        ClubMatchScope.Scope scope = clubMatchScope.resolve(authentication, clubId, sectionId, teamId);
        if (scope.empty()) {
            return empty();
        }
        List<Match> found = clubMatchScope.find(clubId, scope, seasonId, leagueId, includePast, MAX_MATCHES);
        boolean truncated = found.size() > MAX_MATCHES;
        List<Match> candidates = new ArrayList<>(truncated ? found.subList(0, MAX_MATCHES) : found);
        if (includePast) {
            // Fetched latest-first so the cap keeps the latest matches; shown ascending.
            Collections.reverse(candidates);
        }
        Map<UUID, Team> teamsById = teamsOf(candidates);
        Map<UUID, List<Team>> ownTeamsByMatch = new HashMap<>();
        List<Match> matches = new ArrayList<>();
        for (Match match : candidates) {
            List<Team> own = clubMatchScope.ownTeams(match, clubId, scope, teamsById);
            if (!own.isEmpty()) {
                ownTeamsByMatch.put(match.getId(), own);
                matches.add(match);
            }
        }
        if (matches.isEmpty()) {
            return empty();
        }

        Map<MatchTeam, MatchSide> sideByKey = new HashMap<>();
        for (MatchSide side : matchSideRepository.findByMatchIdIn(ids(matches))) {
            sideByKey.put(new MatchTeam(side.getMatchId(), side.getTeamId()), side);
        }
        Map<UUID, List<MatchSidePlayer>> rowsBySide = rowsBySide(sideByKey.values());
        Map<UUID, SelectionLimitsDto> limitsByMatch = limitsOf(matches);

        TeamSelectionBatchRules.Pools pools = batchRules.pools(clubId, matches, ownTeamsByMatch);
        Set<UUID> pickedIds = rowsBySide.values().stream()
                .flatMap(List::stream)
                .map(MatchSidePlayer::getPlayerProfileId)
                .collect(Collectors.toSet());
        Set<UUID> candidateIds = new HashSet<>(pickedIds);
        pools.members().values().forEach(candidateIds::addAll);
        SelectionEligibility eligibility = selectionRules.eligibility();
        Map<UUID, SelectionEligibility.PlayerInfo> players = eligibility.loadPlayers(candidateIds);

        List<UUID> rowOrder = rowOrder(clubId, candidateIds, pickedIds, players);
        if (rowOrder.size() > MAX_PLAYERS) {
            truncated = true;
            rowOrder = rowOrder.subList(0, MAX_PLAYERS);
        }
        Map<MatchTeam, Map<UUID, SelectionRejection>> rejections =
                batchRules.rejections(clubId, matches, ownTeamsByMatch, pools, rowOrder, players);

        Map<UUID, League> leaguesById = leaguesOf(matches);
        Instant startOfToday = ServerClock.startOfToday();
        List<TeamSelectionMatchDto> matchDtos = new ArrayList<>();
        for (Match match : matches) {
            List<TeamSelectionSideDto> sides = new ArrayList<>();
            for (Team team : ownTeamsByMatch.get(match.getId())) {
                MatchSide side = sideByKey.get(new MatchTeam(match.getId(), team.getId()));
                List<MatchSidePlayer> rows = side == null ? List.of() : rowsBySide.getOrDefault(side.getId(), List.of());
                sides.add(toSideDto(match, team, side, rows, limitsByMatch.get(match.getId()), players, teamsById));
            }
            matchDtos.add(toMatchDto(match, sides, teamsById, leaguesById, startOfToday));
        }
        Map<UUID, TeamSelectionMatchDto> dtoByMatch =
                matchDtos.stream().collect(Collectors.toMap(TeamSelectionMatchDto::matchId, dto -> dto));
        List<TeamSelectionPlayerDto> playerDtos = rowOrder.stream()
                .map(playerId -> toPlayerDto(playerId, matches, dtoByMatch, players, rejections))
                .toList();
        return new TeamSelectionOverviewDto(matchDtos, playerDtos, counts(matchDtos), truncated);
    }

    private static TeamSelectionOverviewDto empty() {
        return new TeamSelectionOverviewDto(List.of(), List.of(), new TeamSelectionCountsDto(0, 0, 0, 0, 0), false);
    }

    private Map<UUID, Team> teamsOf(List<Match> matches) {
        Set<UUID> teamIds = new HashSet<>();
        for (Match match : matches) {
            if (match.getHomeTeamId() != null) {
                teamIds.add(match.getHomeTeamId());
            }
            if (match.getAwayTeamId() != null) {
                teamIds.add(match.getAwayTeamId());
            }
        }
        return teamRepository.findAllById(teamIds).stream().collect(Collectors.toMap(Team::getId, team -> team));
    }

    private Map<UUID, League> leaguesOf(List<Match> matches) {
        Set<UUID> leagueIds = matches.stream()
                .map(Match::getLeagueId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        if (leagueIds.isEmpty()) {
            return Map.of();
        }
        return leagueRepository.findAllById(leagueIds).stream().collect(Collectors.toMap(League::getId, l -> l));
    }

    private static Set<UUID> ids(List<Match> matches) {
        return matches.stream().map(Match::getId).collect(Collectors.toSet());
    }

    private Map<UUID, List<MatchSidePlayer>> rowsBySide(java.util.Collection<MatchSide> sides) {
        Map<UUID, List<MatchSidePlayer>> rows = new HashMap<>();
        if (sides.isEmpty()) {
            return rows;
        }
        Set<UUID> sideIds = sides.stream().map(MatchSide::getId).collect(Collectors.toSet());
        for (MatchSidePlayer row : matchSidePlayerRepository.findByMatchSideIdIn(sideIds)) {
            rows.computeIfAbsent(row.getMatchSideId(), key -> new ArrayList<>()).add(row);
        }
        return rows;
    }

    /** The limits per match: one leagues query and one conditions query for the whole page. */
    private Map<UUID, SelectionLimitsDto> limitsOf(List<Match> matches) {
        Set<SelectionLimitsResolver.LeagueSeason> pairs = matches.stream()
                .filter(match -> match.getLeagueId() != null)
                .map(match -> new SelectionLimitsResolver.LeagueSeason(match.getLeagueId(), match.getSeasonId()))
                .collect(Collectors.toSet());
        Map<SelectionLimitsResolver.LeagueSeason, SelectionLimitsDto> byPair = limitsResolver.limitsFor(pairs);
        Map<UUID, SelectionLimitsDto> limits = new HashMap<>();
        for (Match match : matches) {
            SelectionLimitsDto resolved = match.getLeagueId() == null
                    ? limitsResolver.limits(match)
                    : byPair.get(new SelectionLimitsResolver.LeagueSeason(match.getLeagueId(), match.getSeasonId()));
            limits.put(match.getId(), resolved != null ? resolved : limitsResolver.limits(match));
        }
        return limits;
    }

    /** Pool members who can be picked at all (known, active, of this club) and everyone picked, by name. */
    private List<UUID> rowOrder(
            UUID clubId,
            Set<UUID> candidateIds,
            Set<UUID> pickedIds,
            Map<UUID, SelectionEligibility.PlayerInfo> players) {
        return candidateIds.stream()
                .filter(id -> {
                    SelectionEligibility.PlayerInfo info = players.get(id);
                    return info != null && (pickedIds.contains(id) || (info.active() && clubId.equals(info.clubId())));
                })
                .sorted(Comparator
                        .comparing((UUID id) -> players.get(id).firstName().toLowerCase(Locale.ROOT))
                        .thenComparing(id -> players.get(id).lastName().toLowerCase(Locale.ROOT))
                        .thenComparing(Comparator.naturalOrder()))
                .toList();
    }

    private TeamSelectionSideDto toSideDto(
            Match match,
            Team team,
            MatchSide side,
            List<MatchSidePlayer> rows,
            SelectionLimitsDto limits,
            Map<UUID, SelectionEligibility.PlayerInfo> players,
            Map<UUID, Team> teamsById) {
        UUID twelfth = side == null ? null : side.getTwelfthManPlayerId();
        UUID captain = side == null ? null : side.getCaptainPlayerId();
        UUID keeper = side == null ? null : side.getWicketKeeperPlayerId();
        boolean home = team.getId().equals(match.getHomeTeamId());
        long positioned = rows.stream().filter(row -> row.getBattingOrder() != null).count();
        long unpositioned = rows.stream()
                .filter(row -> row.getBattingOrder() == null && !row.getPlayerProfileId().equals(twelfth))
                .count();
        boolean placesFilled = unpositioned == 0 && positioned >= limits.battingPlaces();
        boolean announced = side != null && side.isAnnounced();
        List<TeamSelectionPickDto> picks = rows.stream()
                .map(row -> toPickDto(row, players.get(row.getPlayerProfileId()), captain, keeper, twelfth))
                .sorted(Comparator
                        .comparingInt(TeamSelectionServiceImpl::pickGroup)
                        .thenComparing(pick -> pick.battingOrder() == null ? 0 : pick.battingOrder())
                        .thenComparing(pick -> pick.firstName().toLowerCase(Locale.ROOT))
                        .thenComparing(pick -> pick.lastName().toLowerCase(Locale.ROOT)))
                .toList();
        return new TeamSelectionSideDto(
                side == null ? null : side.getId(),
                team.getId(),
                team.getName(),
                team.getSectionId(),
                home,
                home ? MatchSideNames.away(match, teamsById) : MatchSideNames.home(match, teamsById),
                announced,
                TeamSelectionStatuses.side(announced, rows.size(), placesFilled),
                limits,
                rows.size(),
                placesFilled,
                captain,
                keeper,
                twelfth,
                picks);
    }

    /** Batting positions first, then positionless picks, the 12th man last. */
    private static int pickGroup(TeamSelectionPickDto pick) {
        if (pick.twelfthMan()) {
            return 2;
        }
        return pick.battingOrder() == null ? 1 : 0;
    }

    private static TeamSelectionPickDto toPickDto(
            MatchSidePlayer row, SelectionEligibility.PlayerInfo info, UUID captain, UUID keeper, UUID twelfth) {
        UUID playerId = row.getPlayerProfileId();
        return new TeamSelectionPickDto(
                playerId,
                info == null ? "" : info.firstName(),
                info == null ? "" : info.lastName(),
                row.getBattingOrder(),
                row.getRole(),
                playerId.equals(captain),
                playerId.equals(keeper),
                playerId.equals(twelfth));
    }

    private TeamSelectionMatchDto toMatchDto(
            Match match,
            List<TeamSelectionSideDto> sides,
            Map<UUID, Team> teamsById,
            Map<UUID, League> leaguesById,
            Instant startOfToday) {
        League league = match.getLeagueId() == null ? null : leaguesById.get(match.getLeagueId());
        String homeName = MatchSideNames.home(match, teamsById);
        String awayName = MatchSideNames.away(match, teamsById);
        return new TeamSelectionMatchDto(
                match.getId(),
                match.getMatchDate(),
                matchResolver.dayPartOf(match.getMatchDate()),
                (homeName != null ? homeName : "TBC") + " v " + (awayName != null ? awayName : "TBC"),
                match.getVenue(),
                match.getSeasonId(),
                match.getLeagueId(),
                league == null ? null : league.getName(),
                !match.getMatchDate().isBefore(startOfToday),
                TeamSelectionStatuses.match(sides.stream().map(TeamSelectionSideDto::status).toList()),
                sides);
    }

    private TeamSelectionPlayerDto toPlayerDto(
            UUID playerId,
            List<Match> matches,
            Map<UUID, TeamSelectionMatchDto> dtoByMatch,
            Map<UUID, SelectionEligibility.PlayerInfo> players,
            Map<MatchTeam, Map<UUID, SelectionRejection>> rejections) {
        List<TeamSelectionCellDto> cells = new ArrayList<>();
        int picked = 0;
        for (Match match : matches) {
            for (TeamSelectionSideDto side : dtoByMatch.get(match.getId()).sides()) {
                boolean isPicked = side.picks().stream().anyMatch(pick -> pick.playerId().equals(playerId));
                SelectionRejection rejection =
                        rejections.get(new MatchTeam(match.getId(), side.teamId())).get(playerId);
                SelectionRejectionReason reason = isPicked ? null : reasonOf(rejection, side);
                cells.add(new TeamSelectionCellDto(
                        match.getId(), side.teamId(), side.sideId(), isPicked, reason == null, reason));
                picked += isPicked ? 1 : 0;
            }
        }
        SelectionEligibility.PlayerInfo info = players.get(playerId);
        return new TeamSelectionPlayerDto(playerId, info.firstName(), info.lastName(), picked, cells);
    }

    /** The rules' rejection, else TEAM_FULL when the side already holds the most it may, else none. */
    private static SelectionRejectionReason reasonOf(SelectionRejection rejection, TeamSelectionSideDto side) {
        if (rejection != null) {
            return rejection.reason();
        }
        return side.pickedCount() >= side.limits().maxSelected() ? SelectionRejectionReason.TEAM_FULL : null;
    }

    private static TeamSelectionCountsDto counts(List<TeamSelectionMatchDto> matches) {
        int upcoming = (int) matches.stream().filter(TeamSelectionMatchDto::upcoming).count();
        return new TeamSelectionCountsDto(
                upcoming,
                countOf(matches, TeamSelectionStatus.NOT_STARTED),
                countOf(matches, TeamSelectionStatus.IN_PROGRESS),
                countOf(matches, TeamSelectionStatus.READY_TO_ANNOUNCE),
                countOf(matches, TeamSelectionStatus.ANNOUNCED));
    }

    private static int countOf(List<TeamSelectionMatchDto> matches, TeamSelectionStatus status) {
        return (int) matches.stream().filter(match -> match.status() == status).count();
    }
}
