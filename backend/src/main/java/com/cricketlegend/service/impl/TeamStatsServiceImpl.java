package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Section;
import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardPageInfo;
import com.cricketlegend.dto.TeamStatsFilterOptionsDto;
import com.cricketlegend.dto.TeamStatsTableDto;
import com.cricketlegend.dto.TeamStatsTableDto.TeamStatsBasis;
import com.cricketlegend.dto.TeamStatsTableDto.TeamStatsMinimum;
import com.cricketlegend.dto.TeamStatsTableDto.TeamStatsScope;
import com.cricketlegend.dto.TeamStatsTableDto.TeamStatsSort;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.TeamStatsMapper;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamStatsAggregateRepository;
import com.cricketlegend.repository.TeamStatsAggregateRepository.TeamStatsAggregateView;
import com.cricketlegend.repository.TeamStatsAggregateRepository.TeamStatsBasisView;
import com.cricketlegend.repository.TeamStatsFactsRepository;
import com.cricketlegend.service.TeamStatsService;
import com.cricketlegend.service.support.LeaderboardBoard.Direction;
import com.cricketlegend.service.support.StatsFilterOptionLists;
import com.cricketlegend.service.support.StatsScope;
import com.cricketlegend.service.support.StatsScopeResolver;
import com.cricketlegend.service.support.TeamStatsCalculator;
import com.cricketlegend.service.support.TeamStatsColumn;
import com.cricketlegend.service.support.TeamStatsCounters;
import com.cricketlegend.service.support.TeamStatsCountersReader;
import com.cricketlegend.service.support.TeamTableRanker;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/116-team-stats.md: reads the counters of every team in scope with ONE aggregate query, hands each to {@link
 * TeamStatsCalculator} (so a table figure equals the team page figure) and the lot to {@link TeamTableRanker}, which
 * orders, ranks and pages. No figure, order or tie-break is defined here; this class validates the request, resolves the
 * scope (through {@link StatsScopeResolver}, the same tenancy and section handling as every statistics read), loads the
 * facts and shapes the DTO. No person is named anywhere, and no team name is logged.
 */
@Service
public class TeamStatsServiceImpl implements TeamStatsService {

    private static final Logger log = LoggerFactory.getLogger(TeamStatsServiceImpl.class);

    // The bounded server-side ranking exception to the LIMIT/OFFSET rule (spec 116 "API Contract"; backend.md, Statistics).
    static final int MAX_TEAMS = 1_000;
    static final int DEFAULT_PAGE_SIZE = 25;
    static final int MAX_PAGE_SIZE = 100;
    private static final String KIND = "CLUB_VERIFIED";
    private static final String MINIMUM_UNIT = "MATCHES";

    private final TeamStatsAggregateRepository aggregateRepository;
    private final TeamStatsFactsRepository factsRepository;
    private final SectionRepository sectionRepository;
    private final StatsScopeResolver scopeResolver;
    private final TeamStatsMapper mapper;

    public TeamStatsServiceImpl(
            TeamStatsAggregateRepository aggregateRepository,
            TeamStatsFactsRepository factsRepository,
            SectionRepository sectionRepository,
            StatsScopeResolver scopeResolver,
            TeamStatsMapper mapper) {
        this.aggregateRepository = aggregateRepository;
        this.factsRepository = factsRepository;
        this.sectionRepository = sectionRepository;
        this.scopeResolver = scopeResolver;
        this.mapper = mapper;
    }

    @Override
    @Transactional(readOnly = true)
    public TeamStatsTableDto table(
            Authentication authentication,
            UUID clubId,
            String sortCode,
            String directionText,
            UUID seasonId,
            UUID leagueId,
            UUID sectionId,
            String competitionText,
            String minimumText,
            Integer pageNumber,
            Integer pageSize) {
        StatsScope.Competition competitionFilter = StatsScopeResolver.parseCompetition(competitionText);
        TeamStatsColumn sort = sortCode == null || sortCode.isBlank()
                ? TeamStatsColumn.defaultSort()
                : TeamStatsColumn.byCode(sortCode)
                        .orElseThrow(() -> new ValidationException("Unknown sort for team statistics."));
        Direction direction = sort.getDirection();
        if (directionText != null && !directionText.isBlank()) {
            direction = switch (directionText.trim().toLowerCase(Locale.ROOT)) {
                case "asc" -> Direction.LOWEST;
                case "desc" -> Direction.HIGHEST;
                default -> throw new ValidationException("direction must be asc or desc.");
            };
        }
        Integer minimum = StatsScopeResolver.parseMinimum(minimumText, "minimum");
        boolean rate = sort.getMinimumKind() != TeamStatsColumn.MinimumKind.NONE;
        if (!rate) {
            minimum = null;
        }
        int page = pageNumber == null ? 0 : pageNumber;
        int size = pageSize == null ? DEFAULT_PAGE_SIZE : pageSize;
        if (page < 0) {
            throw new ValidationException("page must be zero or more.");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new ValidationException("size must be between 1 and " + MAX_PAGE_SIZE + ".");
        }

        StatsScopeResolver.Resolved resolved = scopeResolver.resolve(
                authentication, clubId, seasonId, leagueId, null, sectionId, competitionFilter);
        StatsScope scope = resolved.scope();
        List<TeamTableRanker.Candidate> candidates = List.of();
        TeamStatsBasisView basis = null;
        if (!resolved.nothingInReach()) {
            String competition = StatsScopeResolver.competitionName(scope);
            List<UUID> sectionTeams = StatsScopeResolver.sectionTeamParameter(scope);
            List<TeamStatsAggregateView> rows = aggregateRepository.aggregate(
                    clubId, scope.seasonId(), scope.leagueId(), null, competition, scope.sectionRestricted(), sectionTeams);
            if (rows.size() > MAX_TEAMS) {
                log.warn("Team statistics refused for club {}: {} teams in scope (cap {})", clubId, rows.size(), MAX_TEAMS);
                throw new ValidationException(
                        "Too many teams in scope to rank (more than " + MAX_TEAMS + "). Narrow the filters.");
            }
            basis = aggregateRepository.basis(
                    clubId, scope.seasonId(), scope.leagueId(), null, competition, scope.sectionRestricted(), sectionTeams);
            candidates = candidates(clubId, rows);
            log.debug("Team statistics read for club {}: {} teams", clubId, candidates.size());
        }
        TeamTableRanker.Table table = TeamTableRanker.rank(sort, direction, candidates, minimum);

        return new TeamStatsTableDto(
                Arrays.stream(TeamStatsColumn.values()).map(mapper::toColumnInfo).toList(),
                new TeamStatsSort(sort.getCode(), direction.name()),
                new TeamStatsScope(KIND, seasonId, leagueId, sectionId, StatsScopeResolver.competitionName(scope)),
                new TeamStatsMinimum(rate, minimum, MINIMUM_UNIT),
                new TeamStatsBasis(
                        n(basis == null ? null : basis.getResultsCounted()),
                        n(basis == null ? null : basis.getInternalResults()),
                        n(basis == null ? null : basis.getResultsNoBallBowled()),
                        n(basis == null ? null : basis.getForfeits()),
                        table.listed(),
                        table.ranked(),
                        table.belowMinimum()),
                new LeaderboardPageInfo(page, size, table.listed(), ((long) page + 1) * size < table.listed()),
                table.page(page, size));
    }

    @Override
    @Transactional(readOnly = true)
    public TeamStatsFilterOptionsDto filterOptions(Authentication authentication, UUID clubId) {
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
                    scope.sectionRestricted(),
                    StatsScopeResolver.sectionTeamParameter(scope)));
        }
        return new TeamStatsFilterOptionsDto(
                lists.seasonIds(), lists.leagueIds(), lists.sectionIds(), lists.competitions());
    }

    /** Each aggregate row through the calculator, with the team's section name (one section read for the club). */
    private List<TeamTableRanker.Candidate> candidates(UUID clubId, List<TeamStatsAggregateView> rows) {
        if (rows.isEmpty()) {
            return List.of();
        }
        Map<UUID, String> sectionNames = new HashMap<>();
        for (Section section : sectionRepository.findByClubId(clubId)) {
            sectionNames.put(section.getId(), section.getName());
        }
        List<TeamTableRanker.Candidate> candidates = new ArrayList<>(rows.size());
        for (TeamStatsAggregateView row : rows) {
            TeamStatsCounters counters = TeamStatsCountersReader.toCounters(row);
            candidates.add(new TeamTableRanker.Candidate(
                    row.getTeamId(),
                    row.getTeamName(),
                    sectionNames.get(row.getSectionId()),
                    Boolean.TRUE.equals(row.getActive()),
                    TeamStatsCalculator.calculate(counters)));
        }
        return candidates;
    }

    private static long n(Long value) {
        return value == null ? 0L : value;
    }
}
