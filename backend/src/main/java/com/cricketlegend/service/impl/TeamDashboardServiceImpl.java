package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.TeamDashboardDto;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsPageScope;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.TeamStatsMapper;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamStatsAggregateRepository;
import com.cricketlegend.repository.TeamStatsAggregateRepository.TeamStatsAggregateView;
import com.cricketlegend.repository.TeamStatsFactsRepository;
import com.cricketlegend.service.TeamDashboardService;
import com.cricketlegend.service.support.DashboardLimits;
import com.cricketlegend.service.support.StatsScope;
import com.cricketlegend.service.support.StatsScopeResolver;
import com.cricketlegend.service.support.TeamDashboardFactsReader;
import com.cricketlegend.service.support.TeamDashboardSeriesBuilder;
import com.cricketlegend.service.support.TeamStatsCalculator;
import com.cricketlegend.service.support.TeamStatsCounters;
import com.cricketlegend.service.support.TeamStatsCountersReader;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/117-stats-dashboard.md: resolves the filters through {@link StatsScopeResolver} (the same tenancy and section
 * handling as every statistics read), reads the team's counters (for the basis and the Net Run Rate status the page shows)
 * and its newest counted results with the Dashboard's counters (a fixed number of queries), and hands them to {@link
 * TeamDashboardSeriesBuilder}. No figure is decided here, and no team name is logged.
 */
@Service
public class TeamDashboardServiceImpl implements TeamDashboardService {

    private static final Logger log = LoggerFactory.getLogger(TeamDashboardServiceImpl.class);

    private static final String KIND = StatsScopeResolver.KIND_CLUB_VERIFIED;

    private final TeamStatsAggregateRepository aggregateRepository;
    private final TeamStatsFactsRepository factsRepository;
    private final TeamRepository teamRepository;
    private final StatsScopeResolver scopeResolver;
    private final TeamStatsMapper mapper;

    public TeamDashboardServiceImpl(
            TeamStatsAggregateRepository aggregateRepository,
            TeamStatsFactsRepository factsRepository,
            TeamRepository teamRepository,
            StatsScopeResolver scopeResolver,
            TeamStatsMapper mapper) {
        this.aggregateRepository = aggregateRepository;
        this.factsRepository = factsRepository;
        this.teamRepository = teamRepository;
        this.scopeResolver = scopeResolver;
        this.mapper = mapper;
    }

    @Override
    @Transactional(readOnly = true)
    public TeamDashboardDto get(
            Authentication authentication, UUID clubId, UUID teamId, UUID seasonId, UUID leagueId, String competitionText) {
        StatsScope.Competition competitionFilter = StatsScopeResolver.parseCompetition(competitionText);
        // 404 for an unknown or other-club team, season or league; 403 for a team outside a section-scoped caller's reach.
        StatsScopeResolver.Resolved resolved =
                scopeResolver.resolve(authentication, clubId, seasonId, leagueId, teamId, null, competitionFilter);
        StatsScope scope = resolved.scope();
        Team team = teamRepository
                .findById(teamId)
                .filter(candidate -> clubId.equals(candidate.getClubId()))
                .orElseThrow(() -> new NotFoundException("Team not found: " + teamId));
        String competition = StatsScopeResolver.competitionName(scope);

        TeamStatsCounters counters = TeamStatsCounters.EMPTY;
        List<TeamDashboardSeriesBuilder.ResultFact> facts = List.of();
        boolean truncated = false;
        if (!resolved.nothingInReach()) {
            List<UUID> sectionTeams = StatsScopeResolver.sectionTeamParameter(scope);
            List<TeamStatsAggregateView> rows = aggregateRepository.aggregate(
                    clubId, scope.seasonId(), scope.leagueId(), teamId, competition, scope.sectionRestricted(), sectionTeams);
            if (rows.isEmpty()) {
                Long noBall = aggregateRepository
                        .basis(clubId, scope.seasonId(), scope.leagueId(), teamId, competition,
                                scope.sectionRestricted(), sectionTeams)
                        .getResultsNoBallBowled();
                counters = TeamStatsCountersReader.empty(noBall == null ? 0L : noBall);
            } else {
                counters = TeamStatsCountersReader.toCounters(rows.get(0));
                // newest first; the extra row beyond the cap only proves the scope was truncated
                List<TeamDashboardSeriesBuilder.ResultFact> newestFirst = new ArrayList<>(factsRepository
                        .dashboardResults(
                                clubId,
                                scope.seasonId(),
                                scope.leagueId(),
                                teamId,
                                competition,
                                scope.sectionRestricted(),
                                sectionTeams,
                                DashboardLimits.HISTORY_READ)
                        .stream()
                        .map(TeamDashboardFactsReader::toFact)
                        .toList());
                truncated = newestFirst.size() > DashboardLimits.HISTORY_CAP;
                if (truncated) {
                    newestFirst = new ArrayList<>(newestFirst.subList(0, DashboardLimits.HISTORY_CAP));
                }
                Collections.reverse(newestFirst);
                facts = newestFirst;
            }
        }
        TeamStatsCalculator.Figures figures = TeamStatsCalculator.calculate(counters);
        log.debug("Team dashboard for club {} team {}: {} results covered, truncated {}", clubId, teamId, facts.size(), truncated);
        return TeamDashboardSeriesBuilder.build(
                team.getId(),
                team.getName(),
                new TeamStatsPageScope(KIND, seasonId, leagueId, competition),
                mapper.toPageBasis(figures.basis()),
                figures.netRunRate().status(),
                facts,
                truncated,
                mapper.toNotCaptured(figures.notCaptured()));
    }
}
