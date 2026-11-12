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
import com.cricketlegend.service.support.HeldPlayerHistory;
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
                StatsScopeResolver.KIND_CLUB_VERIFIED, seasonId, leagueId, teamId, sectionId, StatsScopeResolver.competitionName(scope));

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

    @Override
    @Transactional(readOnly = true)
    public PlayerDashboardDto getForHeldPlayer(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            StatsScope.Competition competition) {
        return historyForHeldPlayer(clubId, playerId, seasonId, leagueId, teamId, competition).series();
    }

    /**
     * docs/specs/147: the Player Hub scope ({@code playerVisibleOnly}) of the same reads, plus the new fact queries. A fixed
     * number of statements: counters, the newest matches, then (only for a player with counted matches) batting, bowling,
     * credits, fielding, awards, batting detail, dismissed batters and per-season counters.
     */
    @Override
    @Transactional(readOnly = true)
    public HeldPlayerHistory historyForHeldPlayer(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            StatsScope.Competition competition) {
        playerLookup.require(clubId, playerId);
        StatsScope scope = scopeResolver.resolveForHeldPlayer(clubId, seasonId, leagueId, teamId, null, competition);
        PlayerStatsScope echoed = new PlayerStatsScope(
                StatsScopeResolver.KIND_CLUB_VERIFIED, seasonId, leagueId, teamId, null, StatsScopeResolver.competitionName(scope));
        String comp = StatsScopeResolver.competitionName(scope);
        boolean restricted = scope.sectionRestricted();
        List<UUID> sectionTeams = StatsScopeResolver.sectionTeamParameter(scope);
        boolean hubOnly = scope.playerVisibleOnly();

        PlayerStatsCounters counters = PlayerStatsCounters.EMPTY;
        List<PlayerMatchRowBuilder.MatchHeader> headers = List.of();
        boolean truncated = false;
        List<PlayerMatchRowBuilder.BattingFact> batting = List.of();
        List<PlayerMatchRowBuilder.BowlingFact> bowling = List.of();
        List<PlayerStatsCalculator.BowlingCredit> credits = List.of();
        List<PlayerMatchRowBuilder.FieldingFact> fielding = List.of();
        List<PlayerMatchRowBuilder.AwardFact> awards = List.of();
        List<PlayerStatsCalculator.RawBattingDetail> battingDetail = List.of();
        List<PlayerStatsCalculator.WicketDetail> wicketDetail = List.of();
        List<HeldPlayerHistory.SeasonRaw> seasons = List.of();
        List<PlayerStatsCalculator.ResultVenue> venues = List.of();

        List<PlayerStatsAggregateView> rows = aggregateRepository.aggregate(
                clubId, playerId, seasonId, leagueId, teamId, comp, restricted, sectionTeams, hubOnly, null);
        if (!rows.isEmpty()) {
            counters = PlayerStatsCountersReader.toCounters(rows.get(0));
            List<PlayerMatchRowBuilder.MatchHeader> newestFirst = new ArrayList<>(factsRepository
                    .matchPage(
                            clubId,
                            playerId,
                            seasonId,
                            leagueId,
                            teamId,
                            comp,
                            restricted,
                            sectionTeams,
                            false,
                            DashboardLimits.HISTORY_READ,
                            0L,
                            hubOnly,
                            null)
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
                        .matchBatting(clubId, playerId, seasonId, leagueId, teamId, comp, restricted, sectionTeams, resultIds, hubOnly, null)
                        .stream()
                        .map(PlayerMatchFactsReader::toBatting)
                        .toList();
                bowling = factsRepository
                        .matchBowling(clubId, playerId, seasonId, leagueId, teamId, comp, restricted, sectionTeams, resultIds, hubOnly, null)
                        .stream()
                        .map(PlayerMatchFactsReader::toBowling)
                        .toList();
                credits = factsRepository
                        .bowlingCredits(clubId, playerId, seasonId, leagueId, teamId, comp, restricted, sectionTeams, resultIds, hubOnly, null)
                        .stream()
                        .map(PlayerMatchFactsReader::toCredit)
                        .toList();
                fielding = factsRepository
                        .matchFielding(clubId, playerId, seasonId, leagueId, teamId, comp, restricted, sectionTeams, resultIds, hubOnly, null)
                        .stream()
                        .map(PlayerMatchFactsReader::toFielding)
                        .toList();
                awards = factsRepository
                        .matchAwards(clubId, playerId, seasonId, leagueId, teamId, comp, restricted, sectionTeams, resultIds, hubOnly, null)
                        .stream()
                        .map(PlayerMatchFactsReader::toAward)
                        .toList();
                battingDetail = factsRepository
                        .battingDetail(clubId, playerId, seasonId, leagueId, teamId, comp, restricted, sectionTeams, resultIds, hubOnly, null)
                        .stream()
                        .map(PlayerMatchFactsReader::toBattingDetail)
                        .toList();
                venues = factsRepository
                        .resultVenues(clubId, playerId, seasonId, leagueId, teamId, comp, restricted, sectionTeams, resultIds, hubOnly, null)
                        .stream()
                        .map(PlayerMatchFactsReader::toResultVenue)
                        .toList();
                wicketDetail = factsRepository
                        .wicketDetail(clubId, playerId, seasonId, leagueId, teamId, comp, restricted, sectionTeams, resultIds, hubOnly, null)
                        .stream()
                        .map(PlayerMatchFactsReader::toWicketDetail)
                        .toList();
            }
            // the Season filter is ignored for the season-by-season block; every other filter applies
            seasons = factsRepository
                    .seasonCounters(clubId, playerId, null, leagueId, teamId, comp, restricted, sectionTeams, hubOnly, null)
                    .stream()
                    .filter(v -> v.getSeasonId() != null)
                    .map(PlayerMatchFactsReader::toSeasonRaw)
                    .toList();
        }
        log.debug(
                "Held player history for player {} in club {}: {} matches covered, truncated {}",
                playerId,
                clubId,
                headers.size(),
                truncated);
        PlayerDashboardDto series = PlayerDashboardSeriesBuilder.build(
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
        return new HeldPlayerHistory(
                counters,
                truncated,
                PlayerMatchRowBuilder.build(headers, batting, bowling, fielding, awards),
                battingDetail,
                wicketDetail,
                seasons,
                series,
                venues);
    }
}
