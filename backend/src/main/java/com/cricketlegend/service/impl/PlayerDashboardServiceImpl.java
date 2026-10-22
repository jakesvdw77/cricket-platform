package com.cricketlegend.service.impl;

import com.cricketlegend.dto.PlayerDashboardDto;
import com.cricketlegend.dto.PlayerStatsDto.PlayerStatsBasis;
import com.cricketlegend.dto.PlayerStatsDto.PlayerStatsScope;
import com.cricketlegend.repository.PlayerStatsAggregateRepository;
import com.cricketlegend.repository.PlayerStatsAggregateRepository.PlayerStatsAggregateView;
import com.cricketlegend.repository.PlayerStatsFactsRepository;
import com.cricketlegend.service.PlayerDashboardService;
import com.cricketlegend.service.support.ClubPlayerLookup;
import com.cricketlegend.service.support.DashboardLimits;
import com.cricketlegend.service.support.PlayerDashboardSeriesBuilder;
import com.cricketlegend.service.support.PlayerMatchFactsReader;
import com.cricketlegend.service.support.PlayerMatchRowBuilder;
import com.cricketlegend.service.support.PlayerStatsCalculator;
import com.cricketlegend.service.support.PlayerStatsCounters;
import com.cricketlegend.service.support.PlayerStatsCountersReader;
import com.cricketlegend.service.support.StatsScope;
import com.cricketlegend.service.support.StatsScopeResolver;
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
 * docs/specs/117-stats-dashboard.md: validates the filters through {@link StatsScopeResolver} (the one place tenancy and
 * section scope are checked), reads the player's whole-scope counters and the newest counted matches with their batting and
 * bowling rows and credited dismissals (a fixed number of queries), and hands them to {@link PlayerDashboardSeriesBuilder}.
 * No figure is decided here, and no name is logged.
 */
@Service
public class PlayerDashboardServiceImpl implements PlayerDashboardService {

    private static final Logger log = LoggerFactory.getLogger(PlayerDashboardServiceImpl.class);

    private final PlayerStatsAggregateRepository aggregateRepository;
    private final PlayerStatsFactsRepository factsRepository;
    private final ClubPlayerLookup playerLookup;
    private final StatsScopeResolver scopeResolver;

    public PlayerDashboardServiceImpl(
            PlayerStatsAggregateRepository aggregateRepository,
            PlayerStatsFactsRepository factsRepository,
            ClubPlayerLookup playerLookup,
            StatsScopeResolver scopeResolver) {
        this.aggregateRepository = aggregateRepository;
        this.factsRepository = factsRepository;
        this.playerLookup = playerLookup;
        this.scopeResolver = scopeResolver;
    }

    @Override
    @Transactional(readOnly = true)
    public PlayerDashboardDto get(
            Authentication authentication,
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            UUID sectionId,
            String competition) {
        StatsScope.Competition competitionFilter = StatsScopeResolver.parseCompetition(competition);
        playerLookup.require(clubId, playerId);
        StatsScopeResolver.Resolved resolved =
                scopeResolver.resolve(authentication, clubId, seasonId, leagueId, teamId, sectionId, competitionFilter);
        StatsScope scope = resolved.scope();
        PlayerStatsScope echoed = new PlayerStatsScope(
                "CLUB_VERIFIED", seasonId, leagueId, teamId, sectionId, StatsScopeResolver.competitionName(scope));

        PlayerStatsCounters counters = PlayerStatsCounters.EMPTY;
        List<PlayerMatchRowBuilder.MatchHeader> headers = List.of();
        boolean truncated = false;
        List<PlayerMatchRowBuilder.BattingFact> batting = List.of();
        List<PlayerMatchRowBuilder.BowlingFact> bowling = List.of();
        List<PlayerStatsCalculator.BowlingCredit> credits = List.of();
        if (!resolved.nothingInReach()) {
            UUID season = scope.seasonId();
            UUID league = scope.leagueId();
            UUID team = scope.teamId();
            String comp = StatsScopeResolver.competitionName(scope);
            boolean restricted = scope.sectionRestricted();
            List<UUID> sectionTeams = StatsScopeResolver.sectionTeamParameter(scope);

            List<PlayerStatsAggregateView> rows = aggregateRepository.aggregate(
                    clubId, playerId, season, league, team, comp, restricted, sectionTeams);
            if (!rows.isEmpty()) {
                counters = PlayerStatsCountersReader.toCounters(rows.get(0));
                // newest first; the extra row beyond the cap only proves the scope was truncated
                List<PlayerMatchRowBuilder.MatchHeader> newestFirst = new ArrayList<>(factsRepository
                        .matchPage(
                                clubId,
                                playerId,
                                season,
                                league,
                                team,
                                comp,
                                restricted,
                                sectionTeams,
                                false,
                                DashboardLimits.HISTORY_READ,
                                0L)
                        .stream()
                        .map(PlayerMatchFactsReader::toHeader)
                        .toList());
                truncated = newestFirst.size() > DashboardLimits.HISTORY_CAP;
                if (truncated) {
                    newestFirst = new ArrayList<>(newestFirst.subList(0, DashboardLimits.HISTORY_CAP));
                }
                Collections.reverse(newestFirst);
                headers = newestFirst;
                List<UUID> resultIds = headers.stream().map(PlayerMatchRowBuilder.MatchHeader::resultId).toList();
                if (!resultIds.isEmpty()) {
                    batting = factsRepository
                            .matchBatting(clubId, playerId, season, league, team, comp, restricted, sectionTeams, resultIds)
                            .stream()
                            .map(PlayerMatchFactsReader::toBatting)
                            .toList();
                    bowling = factsRepository
                            .matchBowling(clubId, playerId, season, league, team, comp, restricted, sectionTeams, resultIds)
                            .stream()
                            .map(PlayerMatchFactsReader::toBowling)
                            .toList();
                    credits = factsRepository
                            .bowlingCredits(clubId, playerId, season, league, team, comp, restricted, sectionTeams, resultIds)
                            .stream()
                            .map(PlayerMatchFactsReader::toCredit)
                            .toList();
                }
            }
        }
        log.debug(
                "Player dashboard for player {} in club {}: {} matches covered, truncated {}",
                playerId,
                clubId,
                headers.size(),
                truncated);
        return PlayerDashboardSeriesBuilder.build(
                playerId,
                echoed,
                new PlayerStatsBasis(
                        counters.matches(), counters.resultsWithBattingCard(), counters.resultsWithBowlingCard()),
                counters,
                headers,
                truncated,
                batting,
                bowling,
                credits,
                PlayerStatsCalculator.NOT_CAPTURED);
    }
}
