package com.cricketlegend.service.impl;

import com.cricketlegend.dto.AwardsViewDto;
import com.cricketlegend.dto.LeaderboardCatalogueDto;
import com.cricketlegend.dto.LeaderboardCatalogueDto.LeaderboardBoardInfo;
import com.cricketlegend.dto.LeaderboardCatalogueDto.LeaderboardCatalogueGroup;
import com.cricketlegend.dto.LeaderboardFilterOptionsDto;
import com.cricketlegend.dto.AwardsViewDto.LeaderboardDetail;
import com.cricketlegend.dto.AwardsViewDto.LeaderboardRow;
import com.cricketlegend.dto.LeaderboardTableDto;
import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardScope;
import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardTableRow;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LeaderboardMapper;
import com.cricketlegend.repository.PlayerStatsAggregateRepository;
import com.cricketlegend.repository.PlayerStatsAggregateRepository.PlayerStatsAggregateView;
import com.cricketlegend.repository.PlayerStatsFactsRepository;
import com.cricketlegend.repository.PlayerStatsFactsRepository.BestInningsView;
import com.cricketlegend.repository.PlayerStatsFactsRepository.PlayerNameView;
import com.cricketlegend.repository.PlayerStatsFactsRepository.PlayerTeamView;
import com.cricketlegend.service.ClubLeaderboardSettingsService;
import com.cricketlegend.service.LeaderboardService;
import com.cricketlegend.service.PlayerStatsService;
import com.cricketlegend.service.support.HeldLeaderboardTable;
import com.cricketlegend.service.support.HubLeaderboardReach;
import com.cricketlegend.service.support.LeaderboardBoard;
import com.cricketlegend.service.support.LeaderboardColumn;
import com.cricketlegend.service.support.LeaderboardInningsFact;
import com.cricketlegend.service.support.LeaderboardPlayers;
import com.cricketlegend.service.support.LeaderboardQualification;
import com.cricketlegend.service.support.LeaderboardRanker;
import com.cricketlegend.service.support.LeaderboardTableRanker;
import com.cricketlegend.service.support.PlayerStatsCalculator;
import com.cricketlegend.service.support.PlayerStatsCounters;
import com.cricketlegend.service.support.PlayerStatsCountersReader;
import com.cricketlegend.service.support.PlayerStatsFacts;
import com.cricketlegend.service.support.StatsFilterOptionLists;
import com.cricketlegend.service.support.StatsScope;
import com.cricketlegend.service.support.StatsScopeResolver;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Locale;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/103-player-stats.md, "Leaderboards": reads the counters of every player in scope with ONE aggregate query,
 * hands them to {@link PlayerStatsCalculator} (so a board figure equals the Player page figure) and to {@link
 * LeaderboardRanker}, which orders, ranks and pages. Awards rank every category in memory from the same read. No figure,
 * order or tie-break is defined here; this class resolves the scope (through {@link StatsScopeResolver}, the same section
 * handling as the Player page), loads the facts and shapes the DTOs.
 */
@Service
public class LeaderboardServiceImpl implements LeaderboardService {

    private static final Logger log = LoggerFactory.getLogger(LeaderboardServiceImpl.class);

    // The bounded server-side ranking exception to the LIMIT/OFFSET rule (spec 103 "Architecture proposal" point 5; backend.md, Statistics).
    static final int MAX_PLAYERS = 5_000;
    static final int DEFAULT_PAGE_SIZE = 10;
    static final int MAX_PAGE_SIZE = 100;
    private static final String KIND = StatsScopeResolver.KIND_CLUB_VERIFIED;

    private final PlayerStatsAggregateRepository aggregateRepository;
    private final PlayerStatsFactsRepository factsRepository;
    private final StatsScopeResolver scopeResolver;
    private final ClubLeaderboardSettingsService settingsService;
    private final LeaderboardMapper mapper;

    public LeaderboardServiceImpl(
            PlayerStatsAggregateRepository aggregateRepository,
            PlayerStatsFactsRepository factsRepository,
            StatsScopeResolver scopeResolver,
            ClubLeaderboardSettingsService settingsService,
            LeaderboardMapper mapper) {
        this.aggregateRepository = aggregateRepository;
        this.factsRepository = factsRepository;
        this.scopeResolver = scopeResolver;
        this.settingsService = settingsService;
        this.mapper = mapper;
    }

    @Override
    @Transactional(readOnly = true)
    public LeaderboardCatalogueDto catalogue() {
        List<LeaderboardCatalogueGroup> groups = new ArrayList<>();
        for (LeaderboardBoard.Group group : LeaderboardBoard.Group.values()) {
            List<LeaderboardBoardInfo> boards = LeaderboardBoard.all().stream()
                    .filter(board -> board.getGroup() == group)
                    .map(mapper::toInfo)
                    .toList();
            boolean standings = group != LeaderboardBoard.Group.AWARDS;
            groups.add(new LeaderboardCatalogueGroup(
                    group.name(),
                    standings ? routeCode(group) : null,
                    group.getLabel(),
                    standings ? LeaderboardColumn.defaultFor(group).getCode() : null,
                    standings ? LeaderboardColumn.of(group).stream().map(mapper::toColumnInfo).toList() : List.of(),
                    boards));
        }
        return new LeaderboardCatalogueDto(groups);
    }

    @Override
    @Transactional(readOnly = true)
    public LeaderboardTableDto table(
            Authentication authentication,
            UUID clubId,
            String groupCode,
            String sortCode,
            String directionText,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            UUID sectionId,
            String minimumText,
            Integer pageNumber,
            Integer pageSize) {
        TableRequest request = TableRequest.parse(groupCode, sortCode, directionText, minimumText, pageNumber, pageSize);
        LeaderboardPlayers loaded = load(authentication, clubId, seasonId, leagueId, teamId, sectionId);
        return rankTable(request, loaded, new LeaderboardScope(KIND, seasonId, leagueId, teamId, sectionId)).page();
    }

    /**
     * docs/specs/147: the same table for the Player Hub scope (only results switched on for the Player Hub, only the
     * players of {@code leagueReach}, no section reach), plus where the held player's own row is in the whole ordered
     * table. The parameters are validated and the table ranked exactly as {@link #table} does.
     */
    @Override
    @Transactional(readOnly = true)
    public HeldLeaderboardTable tableForHeldPlayer(
            UUID clubId,
            UUID playerId,
            String groupCode,
            String sortCode,
            String directionText,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            Set<UUID> leagueReach,
            String minimumText,
            Integer pageNumber,
            Integer pageSize) {
        TableRequest request = TableRequest.parse(groupCode, sortCode, directionText, minimumText, pageNumber, pageSize);
        LeaderboardPlayers loaded = loadScope(
                scopeResolver.resolveForHeldPlayer(clubId, seasonId, leagueId, teamId, null, null).withLeagueReach(leagueReach),
                leagueReach.isEmpty(),
                true);
        Ranked ranked = rankTable(request, loaded, new LeaderboardScope(KIND, seasonId, leagueId, teamId, null));
        List<LeaderboardTableRow> all = ranked.table().rows();
        int position = -1;
        for (int i = 0; i < all.size(); i++) {
            if (playerId.equals(all.get(i).playerId())) {
                position = i;
                break;
            }
        }
        return new HeldLeaderboardTable(ranked.page(), position < 0 ? null : all.get(position), position);
    }

    /** The ranked table and its page DTO for already validated parameters and loaded players. */
    private Ranked rankTable(TableRequest request, LeaderboardPlayers loaded, LeaderboardScope scopeDto) {
        LeaderboardColumn sort = request.sort();
        LeaderboardBoard.Group group = request.group();
        LeaderboardQualification.Defaults defaults = defaultsOf(loaded);
        Map<UUID, LeaderboardInningsFact> facts = new HashMap<>(tieBreakFacts(sort.getBoard(), loaded));
        LeaderboardTableRanker.Table table = LeaderboardTableRanker.rank(
                group, sort, request.direction(), loaded.candidates(), request.minimum(), defaults, teamNames(loaded), facts);

        LeaderboardTableDto.LeaderboardMinimum minimumDto = new LeaderboardTableDto.LeaderboardMinimum(
                request.rate(),
                request.minimum(),
                request.rate() ? LeaderboardQualification.suggestedFor(sort.getBoard(), defaults) : null,
                sort.getMinimumKind().name());
        LeaderboardTableDto dto = new LeaderboardTableDto(
                routeCode(group),
                LeaderboardColumn.of(group).stream().map(mapper::toColumnInfo).toList(),
                new LeaderboardTableDto.LeaderboardSort(sort.getCode(), request.direction().name()),
                scopeDto,
                minimumDto,
                new LeaderboardTableDto.LeaderboardBasis(
                        loaded.resultsCounted(), table.listed(), table.ranked(), table.belowMinimum(), table.coverage()),
                new LeaderboardTableDto.LeaderboardPageInfo(
                        request.page(), request.size(), table.listed(), ((long) request.page() + 1) * request.size() < table.listed()),
                table.page(request.page(), request.size()));
        return new Ranked(table, dto);
    }

    private record Ranked(LeaderboardTableRanker.Table table, LeaderboardTableDto page) {
    }

    /** The validated table parameters, in the order the checks run (group, sort, direction, minimum, page, size). */
    private record TableRequest(
            LeaderboardBoard.Group group,
            LeaderboardColumn sort,
            LeaderboardBoard.Direction direction,
            boolean rate,
            Integer minimum,
            int page,
            int size) {

        static TableRequest parse(
                String groupCode,
                String sortCode,
                String directionText,
                String minimumText,
                Integer pageNumber,
                Integer pageSize) {
            LeaderboardBoard.Group group = Arrays.stream(LeaderboardBoard.Group.values())
                    .filter(g -> g != LeaderboardBoard.Group.AWARDS && routeCode(g).equals(groupCode))
                    .findFirst()
                    .orElseThrow(() -> new NotFoundException("Leaderboard not found: " + groupCode));
            LeaderboardColumn sort = sortCode == null || sortCode.isBlank()
                    ? LeaderboardColumn.defaultFor(group)
                    : LeaderboardColumn.byCode(group, sortCode)
                            .orElseThrow(() -> new ValidationException("Unknown sort for " + groupCode + ": " + sortCode));
            LeaderboardBoard.Direction direction = sort.getDirection();
            if (directionText != null && !directionText.isBlank()) {
                direction = switch (directionText.trim().toLowerCase(Locale.ROOT)) {
                    case "asc" -> LeaderboardBoard.Direction.LOWEST;
                    case "desc" -> LeaderboardBoard.Direction.HIGHEST;
                    default -> throw new ValidationException("direction must be asc or desc.");
                };
            }
            Integer minimum = parseMinimum(minimumText, "minimum");
            boolean rate = sort.getMinimumKind() != LeaderboardBoard.MinimumKind.NONE;
            if (!rate) {
                minimum = null;
            }
            int page = pageNumber == null ? 0 : pageNumber;
            int size = pageSize == null ? DEFAULT_PAGE_SIZE : pageSize;
            if (page < 0) {
                throw new ValidationException("page must be zero or more.");
            }
            if (size < 1) {
                throw new ValidationException("size must be at least 1.");
            }
            return new TableRequest(group, sort, direction, rate, minimum, page, Math.min(size, MAX_PAGE_SIZE));
        }
    }

    private static String routeCode(LeaderboardBoard.Group group) {
        return group.name().toLowerCase(Locale.ROOT);
    }

    @Override
    @Transactional(readOnly = true)
    public AwardsViewDto awards(
            Authentication authentication,
            UUID clubId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            UUID sectionId,
            String minimumInningsText,
            String minimumOversText) {
        Integer requestedInnings = parseMinimum(minimumInningsText, "minimumInnings");
        Integer requestedOvers = parseMinimum(minimumOversText, "minimumOvers");
        LeaderboardPlayers loaded = load(authentication, clubId, seasonId, leagueId, teamId, sectionId);
        return buildAwards(
                clubId,
                loaded,
                new LeaderboardScope(KIND, seasonId, leagueId, teamId, sectionId),
                requestedInnings,
                requestedOvers);
    }

    /** docs/specs/147: the same category leaders for the Player Hub scope; the default minimums apply. */
    @Override
    @Transactional(readOnly = true)
    public AwardsViewDto awardsForHeldPlayer(
            UUID clubId, UUID seasonId, UUID leagueId, UUID teamId, Set<UUID> leagueReach) {
        LeaderboardPlayers loaded = loadScope(
                scopeResolver.resolveForHeldPlayer(clubId, seasonId, leagueId, teamId, null, null).withLeagueReach(leagueReach),
                leagueReach.isEmpty(),
                true);
        return buildAwards(clubId, loaded, new LeaderboardScope(KIND, seasonId, leagueId, teamId, null), null, null);
    }

    private AwardsViewDto buildAwards(
            UUID clubId,
            LeaderboardPlayers loaded,
            LeaderboardScope scopeDto,
            Integer requestedInnings,
            Integer requestedOvers) {
        List<LeaderboardBoard> categories = settingsService.awardBoards(clubId);
        LeaderboardQualification.Defaults defaults = defaultsOf(loaded);
        int minInnings = requestedInnings == null ? defaults.innings() : requestedInnings;
        int minOvers = requestedOvers == null ? defaults.overs() : requestedOvers;

        Map<UUID, LeaderboardInningsFact> facts = new HashMap<>(tieBreakFacts(LeaderboardBoard.HIGHEST_SCORE, loaded));
        List<AwardsViewDto.AwardsCategory> shown = new ArrayList<>();
        List<AwardsViewDto.AwardsOmittedCategory> omitted = new ArrayList<>();
        for (LeaderboardBoard board : categories) {
            Integer minimum = LeaderboardQualification.valueFor(board, minInnings, minOvers);
            LeaderboardRanker.Ranking ranking =
                    LeaderboardRanker.rank(board, loaded.candidates(), minimum, defaults, facts);
            List<LeaderboardRow> leaders = ranking.leaders();
            if (leaders.isEmpty()) {
                omitted.add(new AwardsViewDto.AwardsOmittedCategory(
                        mapper.toInfo(board), LeaderboardRanker.omissionReason(board, ranking, minimum)));
            } else {
                shown.add(new AwardsViewDto.AwardsCategory(
                        mapper.toInfo(board), withDetails(board, loaded, leaders, facts)));
            }
        }
        return new AwardsViewDto(
                scopeDto,
                new AwardsViewDto.AwardsBasis(loaded.resultsCounted(), loaded.candidates().size()),
                new AwardsViewDto.AwardsMinimums(minInnings, minOvers, defaults.innings(), defaults.overs()),
                shown,
                omitted);
    }

    @Override
    @Transactional(readOnly = true)
    public LeaderboardFilterOptionsDto filterOptions(Authentication authentication, UUID clubId) {
        StatsScopeResolver.Resolved resolved =
                scopeResolver.resolve(authentication, clubId, null, null, null, null, null);
        StatsFilterOptionLists lists = StatsFilterOptionLists.EMPTY;
        if (!resolved.nothingInReach()) {
            StatsScope scope = resolved.scope();
            lists = StatsFilterOptionLists.of(factsRepository.filterOptions(
                    clubId,
                    null,
                    null,
                    null,
                    null,
                    null,
                    scope.sectionRestricted(),
                    StatsScopeResolver.sectionTeamParameter(scope)));
        }
        return new LeaderboardFilterOptionsDto(
                lists.seasonIds(), lists.leagueIds(), lists.teamIds(), lists.sectionIds(), lists.competitions());
    }

    /**
     * docs/specs/147: the (season, league, team) combinations of the flagged, counted appearances of every player in the
     * leagues of {@code reach}, kept to the (season, league) pairs the reach names. Reads one filter-option statement.
     */
    @Override
    @Transactional(readOnly = true)
    public List<PlayerStatsService.PlayerStatsCombo> comboOptionsForHeldPlayer(UUID clubId, HubLeaderboardReach reach) {
        Set<UUID> leagues = reach.leagueIds(null);
        if (leagues.isEmpty()) {
            return List.of();
        }
        return factsRepository
                .filterOptions(
                        clubId,
                        null,
                        null,
                        null,
                        null,
                        null,
                        false,
                        List.of(new UUID(0L, 0L)),
                        true,
                        null,
                        true,
                        List.copyOf(leagues))
                .stream()
                .filter(row -> row.getLeagueId() != null && reach.contains(row.getSeasonId(), row.getLeagueId()))
                .map(row -> new PlayerStatsService.PlayerStatsCombo(row.getSeasonId(), row.getLeagueId(), row.getTeamId()))
                .distinct()
                .toList();
    }

    /**
     * docs/specs/147: everyone in a Player Hub scope as ranker candidates. {@code leagueReach} (null is unrestricted) keeps
     * only matches of those leagues, {@code teamIds} (null is unrestricted) only the games of those club teams; only
     * results switched on for the Player Hub count. Season, league and team must belong to the club (404 otherwise).
     */
    @Override
    @Transactional(readOnly = true)
    public LeaderboardPlayers playersForHeldPlayer(
            UUID clubId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            StatsScope.Competition competition,
            Set<UUID> leagueReach,
            Set<UUID> teamIds,
            boolean countResults) {
        StatsScope scope = scopeResolver.resolveForHeldPlayer(clubId, seasonId, leagueId, teamId, null, competition);
        if (leagueReach != null) {
            scope = scope.withLeagueReach(leagueReach);
        }
        if (teamIds != null) {
            scope = scope.withTeams(teamIds);
        }
        boolean nothing = (leagueReach != null && leagueReach.isEmpty()) || (teamIds != null && teamIds.isEmpty());
        return loadScope(scope, nothing, countResults);
    }

    // ---- loading ----

    /** One aggregate query for the whole scope, joined in memory to the club roster for names and status. */
    private LeaderboardPlayers load(
            Authentication authentication,
            UUID clubId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            UUID sectionId) {
        StatsScopeResolver.Resolved resolved =
                scopeResolver.resolve(authentication, clubId, seasonId, leagueId, teamId, sectionId, null);
        return loadScope(resolved.scope(), resolved.nothingInReach(), true);
    }

    private LeaderboardPlayers loadScope(StatsScope scope, boolean nothingInReach, boolean countResults) {
        if (nothingInReach) {
            return new LeaderboardPlayers(scope, List.of(), 0);
        }
        UUID clubId = scope.clubId();
        List<PlayerStatsAggregateView> rows = aggregateRows(scope);
        if (rows.size() > MAX_PLAYERS) {
            log.warn("Leaderboard refused for club {}: {} players in scope (cap {})", clubId, rows.size(), MAX_PLAYERS);
            throw new ValidationException(
                    "Too many players in scope to rank (more than " + MAX_PLAYERS + "). Narrow the filters.");
        }
        Map<UUID, PlayerNameView> roster = new HashMap<>();
        for (PlayerNameView player : factsRepository.clubPlayers(clubId)) {
            roster.put(player.getPlayerId(), player);
        }
        List<LeaderboardRanker.Candidate> candidates = new ArrayList<>(rows.size());
        for (PlayerStatsAggregateView row : rows) {
            PlayerNameView player = roster.get(row.getPlayerId());
            if (player == null) {
                continue;
            }
            PlayerStatsCounters counters = PlayerStatsCountersReader.toCounters(row);
            candidates.add(new LeaderboardRanker.Candidate(
                    row.getPlayerId(),
                    player.getFirstName(),
                    player.getLastName(),
                    Boolean.TRUE.equals(player.getActive()),
                    counters,
                    PlayerStatsCalculator.calculate(counters, PlayerStatsFacts.EMPTY)));
        }
        long results = countResults ? countResultRows(scope) : 0;
        log.debug("Leaderboard read for club {}: {} players, {} results", clubId, candidates.size(), results);
        return new LeaderboardPlayers(scope, candidates, results);
    }

    // A manager scope keeps the original eight-argument repository calls; a Player Hub scope (docs/specs/145 and 147) also
    // passes the Player Hub flag and the optional league reach.

    private List<PlayerStatsAggregateView> aggregateRows(StatsScope scope) {
        String competition = StatsScopeResolver.competitionName(scope);
        List<UUID> sectionTeams = StatsScopeResolver.sectionTeamParameter(scope);
        if (!scope.playerVisibleOnly()) {
            return aggregateRepository.aggregate(
                    scope.clubId(), null, scope.seasonId(), scope.leagueId(), scope.teamId(), competition,
                    scope.sectionRestricted(), sectionTeams);
        }
        return aggregateRepository.aggregate(
                scope.clubId(), null, scope.seasonId(), scope.leagueId(), scope.teamId(), competition,
                scope.sectionRestricted(), sectionTeams, true, scope.matchId(), scope.leagueReachRestricted(),
                StatsScopeResolver.leagueReachParameter(scope));
    }

    private long countResultRows(StatsScope scope) {
        String competition = StatsScopeResolver.competitionName(scope);
        List<UUID> sectionTeams = StatsScopeResolver.sectionTeamParameter(scope);
        if (!scope.playerVisibleOnly()) {
            return factsRepository.countResults(
                    scope.clubId(), null, scope.seasonId(), scope.leagueId(), scope.teamId(), competition,
                    scope.sectionRestricted(), sectionTeams);
        }
        return factsRepository.countResults(
                scope.clubId(), null, scope.seasonId(), scope.leagueId(), scope.teamId(), competition,
                scope.sectionRestricted(), sectionTeams, true, scope.matchId(), scope.leagueReachRestricted(),
                StatsScopeResolver.leagueReachParameter(scope));
    }

    private List<PlayerTeamView> playerTeamRows(StatsScope scope) {
        String competition = StatsScopeResolver.competitionName(scope);
        List<UUID> sectionTeams = StatsScopeResolver.sectionTeamParameter(scope);
        if (!scope.playerVisibleOnly()) {
            return factsRepository.playerTeams(
                    scope.clubId(), null, scope.seasonId(), scope.leagueId(), scope.teamId(), competition,
                    scope.sectionRestricted(), sectionTeams);
        }
        return factsRepository.playerTeams(
                scope.clubId(), null, scope.seasonId(), scope.leagueId(), scope.teamId(), competition,
                scope.sectionRestricted(), sectionTeams, true, scope.matchId(), scope.leagueReachRestricted(),
                StatsScopeResolver.leagueReachParameter(scope));
    }

    private List<BestInningsView> bestInningsRows(StatsScope scope, boolean innings, Collection<UUID> playerIds) {
        String competition = StatsScopeResolver.competitionName(scope);
        List<UUID> sectionTeams = StatsScopeResolver.sectionTeamParameter(scope);
        if (!scope.playerVisibleOnly()) {
            return innings
                    ? factsRepository.bestInnings(
                            scope.clubId(), null, scope.seasonId(), scope.leagueId(), scope.teamId(), competition,
                            scope.sectionRestricted(), sectionTeams, playerIds)
                    : factsRepository.bestSpells(
                            scope.clubId(), null, scope.seasonId(), scope.leagueId(), scope.teamId(), competition,
                            scope.sectionRestricted(), sectionTeams, playerIds);
        }
        return innings
                ? factsRepository.bestInnings(
                        scope.clubId(), null, scope.seasonId(), scope.leagueId(), scope.teamId(), competition,
                        scope.sectionRestricted(), sectionTeams, playerIds, true, scope.matchId(),
                        scope.leagueReachRestricted(), StatsScopeResolver.leagueReachParameter(scope))
                : factsRepository.bestSpells(
                        scope.clubId(), null, scope.seasonId(), scope.leagueId(), scope.teamId(), competition,
                        scope.sectionRestricted(), sectionTeams, playerIds, true, scope.matchId(),
                        scope.leagueReachRestricted(), StatsScopeResolver.leagueReachParameter(scope));
    }

    private static LeaderboardQualification.Defaults defaultsOf(LeaderboardPlayers loaded) {
        return LeaderboardQualification.defaultsForScope(
                loaded.candidates().stream().map(LeaderboardRanker.Candidate::counters).toList());
    }

    /** Each player's most frequent counted own-side team in scope (ties: the name first alphabetically); one grouped query. */
    private Map<UUID, String> teamNames(LeaderboardPlayers loaded) {
        if (loaded.candidates().isEmpty()) {
            return Map.of();
        }
        Map<UUID, PlayerTeamView> best = new HashMap<>();
        for (PlayerTeamView view : playerTeamRows(loaded.scope())) {
            PlayerTeamView current = best.get(view.getPlayerId());
            if (current == null || view.getTotal() > current.getTotal()
                    || (view.getTotal().equals(current.getTotal())
                            && view.getTeamName().compareToIgnoreCase(current.getTeamName()) < 0)) {
                best.put(view.getPlayerId(), view);
            }
        }
        Map<UUID, String> names = new HashMap<>();
        best.forEach((playerId, view) -> names.put(playerId, view.getTeamName()));
        return names;
    }

    // ---- single-innings facts ----

    /**
     * Highest score breaks ties on balls faced, which the aggregate does not carry: read the best innings of exactly the
     * players that share a highest score. Other boards need nothing.
     */
    private Map<UUID, LeaderboardInningsFact> tieBreakFacts(LeaderboardBoard board, LeaderboardPlayers loaded) {
        if (board != LeaderboardBoard.HIGHEST_SCORE) {
            return Map.of();
        }
        Map<Long, List<UUID>> byKey = new HashMap<>();
        for (LeaderboardRanker.Candidate candidate : loaded.candidates()) {
            Long key = candidate.counters().batting().highestScoreKey();
            if (key != null) {
                byKey.computeIfAbsent(key, k -> new ArrayList<>()).add(candidate.playerId());
            }
        }
        Set<UUID> tied = new LinkedHashSet<>();
        byKey.values().stream().filter(ids -> ids.size() > 1).forEach(tied::addAll);
        return bestInningsFacts(board, loaded, tied);
    }

    /** Adds the match line (match, date, opponent) to rows of the single-innings boards; other boards are untouched. */
    private List<LeaderboardRow> withDetails(
            LeaderboardBoard board,
            LeaderboardPlayers loaded,
            List<LeaderboardRow> rows,
            Map<UUID, LeaderboardInningsFact> known) {
        if ((board != LeaderboardBoard.HIGHEST_SCORE && board != LeaderboardBoard.BEST_BOWLING) || rows.isEmpty()) {
            return rows;
        }
        // the known facts are best innings (highest score); they say nothing about best bowling
        Map<UUID, LeaderboardInningsFact> usable = board == LeaderboardBoard.HIGHEST_SCORE ? known : Map.of();
        Set<UUID> missing = new HashSet<>();
        rows.stream().map(LeaderboardRow::playerId).filter(id -> !usable.containsKey(id)).forEach(missing::add);
        Map<UUID, LeaderboardInningsFact> facts = new HashMap<>(usable);
        facts.putAll(bestInningsFacts(board, loaded, missing));
        List<LeaderboardRow> result = new ArrayList<>(rows.size());
        for (LeaderboardRow row : rows) {
            LeaderboardInningsFact fact = facts.get(row.playerId());
            result.add(fact == null
                    ? row
                    : row.withDetail(new LeaderboardDetail(fact.matchId(), fact.matchDate(), fact.opponent())));
        }
        return result;
    }

    private Map<UUID, LeaderboardInningsFact> bestInningsFacts(
            LeaderboardBoard board, LeaderboardPlayers loaded, Collection<UUID> playerIds) {
        if (playerIds.isEmpty()) {
            return Map.of();
        }
        List<BestInningsView> views =
                bestInningsRows(loaded.scope(), board == LeaderboardBoard.HIGHEST_SCORE, playerIds);
        Map<UUID, LeaderboardInningsFact> facts = new HashMap<>();
        for (BestInningsView view : views) {
            facts.put(
                    view.getPlayerId(),
                    new LeaderboardInningsFact(
                            view.getMatchId(),
                            view.getMatchEpochMillis() == null ? null : Instant.ofEpochMilli(view.getMatchEpochMillis()),
                            view.getOpponent(),
                            view.getBalls()));
        }
        return facts;
    }

    // ---- parameters ----

    private static Integer parseMinimum(String text, String name) {
        return StatsScopeResolver.parseMinimum(text, name);
    }
}
