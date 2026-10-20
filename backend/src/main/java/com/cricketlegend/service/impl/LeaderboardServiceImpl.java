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
    private static final String KIND = "CLUB_VERIFIED";

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
        size = Math.min(size, MAX_PAGE_SIZE);

        LeaderboardPlayers loaded = load(authentication, clubId, seasonId, leagueId, teamId, sectionId);
        LeaderboardQualification.Defaults defaults = defaultsOf(loaded);
        Map<UUID, LeaderboardInningsFact> facts = new HashMap<>(tieBreakFacts(sort.getBoard(), loaded));
        LeaderboardTableRanker.Table table = LeaderboardTableRanker.rank(
                group, sort, direction, loaded.candidates(), minimum, defaults, teamNames(loaded), facts);

        LeaderboardTableDto.LeaderboardMinimum minimumDto = new LeaderboardTableDto.LeaderboardMinimum(
                rate,
                minimum,
                rate ? LeaderboardQualification.suggestedFor(sort.getBoard(), defaults) : null,
                sort.getMinimumKind().name());
        return new LeaderboardTableDto(
                routeCode(group),
                LeaderboardColumn.of(group).stream().map(mapper::toColumnInfo).toList(),
                new LeaderboardTableDto.LeaderboardSort(sort.getCode(), direction.name()),
                new LeaderboardScope(KIND, seasonId, leagueId, teamId, sectionId),
                minimumDto,
                new LeaderboardTableDto.LeaderboardBasis(
                        loaded.resultsCounted(), table.listed(), table.ranked(), table.belowMinimum(), table.coverage()),
                new LeaderboardTableDto.LeaderboardPageInfo(
                        page, size, table.listed(), ((long) page + 1) * size < table.listed()),
                table.page(page, size));
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
        List<LeaderboardBoard> categories = settingsService.awardBoards(clubId);

        LeaderboardPlayers loaded = load(authentication, clubId, seasonId, leagueId, teamId, sectionId);
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
                new LeaderboardScope(KIND, seasonId, leagueId, teamId, sectionId),
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
        StatsScope scope = resolved.scope();
        if (resolved.nothingInReach()) {
            return new LeaderboardPlayers(scope, List.of(), 0);
        }
        String competition = StatsScopeResolver.competitionName(scope);
        List<UUID> sectionTeams = StatsScopeResolver.sectionTeamParameter(scope);
        List<PlayerStatsAggregateView> rows = aggregateRepository.aggregate(
                clubId,
                null,
                scope.seasonId(),
                scope.leagueId(),
                scope.teamId(),
                competition,
                scope.sectionRestricted(),
                sectionTeams);
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
        long results = factsRepository.countResults(
                clubId,
                null,
                scope.seasonId(),
                scope.leagueId(),
                scope.teamId(),
                competition,
                scope.sectionRestricted(),
                sectionTeams);
        log.debug("Leaderboard read for club {}: {} players, {} results", clubId, candidates.size(), results);
        return new LeaderboardPlayers(scope, candidates, results);
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
        StatsScope scope = loaded.scope();
        Map<UUID, PlayerTeamView> best = new HashMap<>();
        for (PlayerTeamView view : factsRepository.playerTeams(
                scope.clubId(),
                null,
                scope.seasonId(),
                scope.leagueId(),
                scope.teamId(),
                StatsScopeResolver.competitionName(scope),
                scope.sectionRestricted(),
                StatsScopeResolver.sectionTeamParameter(scope))) {
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
        StatsScope scope = loaded.scope();
        List<BestInningsView> views = board == LeaderboardBoard.HIGHEST_SCORE
                ? factsRepository.bestInnings(
                        scope.clubId(),
                        null,
                        scope.seasonId(),
                        scope.leagueId(),
                        scope.teamId(),
                        StatsScopeResolver.competitionName(scope),
                        scope.sectionRestricted(),
                        StatsScopeResolver.sectionTeamParameter(scope),
                        playerIds)
                : factsRepository.bestSpells(
                        scope.clubId(),
                        null,
                        scope.seasonId(),
                        scope.leagueId(),
                        scope.teamId(),
                        StatsScopeResolver.competitionName(scope),
                        scope.sectionRestricted(),
                        StatsScopeResolver.sectionTeamParameter(scope),
                        playerIds);
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
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            int value = Integer.parseInt(text.trim());
            if (value < 0) {
                throw new ValidationException(name + " must be a whole number of zero or more.");
            }
            return value;
        } catch (NumberFormatException e) {
            throw new ValidationException(name + " must be a whole number of zero or more.");
        }
    }
}
