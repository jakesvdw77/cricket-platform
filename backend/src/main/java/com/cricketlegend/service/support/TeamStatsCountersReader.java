package com.cricketlegend.service.support;

import com.cricketlegend.repository.TeamStatsAggregateRepository.TeamStatsAggregateView;
import java.math.BigDecimal;

/**
 * docs/specs/116-team-stats.md: turns one row of the team aggregate query into {@link TeamStatsCounters}. Shared by the
 * table and (later) the team page so both feed {@link TeamStatsCalculator} identically (parity). It copies numbers and
 * decodes nothing; no figure is computed here.
 */
public final class TeamStatsCountersReader {

    private TeamStatsCountersReader() {}

    public static TeamStatsCounters toCounters(TeamStatsAggregateView v) {
        return new TeamStatsCounters(
                new TeamStatsCounters.Results(
                        n(v.getResults()),
                        n(v.getRecWon()),
                        n(v.getRecLost()),
                        n(v.getRecTied()),
                        n(v.getRecDrawn()),
                        n(v.getRecNoResult()),
                        n(v.getRecForfeitsReceived()),
                        n(v.getRecForfeitsConceded()),
                        n(v.getRecInternal()),
                        n(v.getNoBallBowled())),
                new TeamStatsCounters.Innings(
                        n(v.getOwnInnings()),
                        n(v.getOwnUsable()),
                        n(v.getOwnRuns()),
                        n(v.getOwnWickets()),
                        n(v.getOwnBalls()),
                        n(v.getOwnRunsWithBalls()),
                        zero(v.getOwnOvers()),
                        n(v.getHighLowInnings()),
                        n(v.getLowClassifiable())),
                new TeamStatsCounters.Innings(
                        n(v.getOppInnings()),
                        n(v.getOppUsable()),
                        n(v.getOppRuns()),
                        n(v.getOppWickets()),
                        n(v.getOppBalls()),
                        n(v.getOppRunsWithBalls()),
                        zero(v.getOppOvers()),
                        0,
                        0),
                new TeamStatsCounters.Extras(
                        new TeamStatsCounters.Component(n(v.getExtrasInnings()), n(v.getExtras())),
                        new TeamStatsCounters.Component(n(v.getWidesInnings()), n(v.getWides())),
                        new TeamStatsCounters.Component(n(v.getNoBallsInnings()), n(v.getNoBalls())),
                        new TeamStatsCounters.Component(n(v.getByesInnings()), n(v.getByes())),
                        new TeamStatsCounters.Component(n(v.getLegByesInnings()), n(v.getLegByes())),
                        new TeamStatsCounters.Component(n(v.getPenaltyInnings()), n(v.getPenaltyRuns()))),
                new TeamStatsCounters.Keys(
                        v.getHighTotalKey(),
                        v.getLowTotalKey(),
                        v.getChaseKey(),
                        v.getVictoryRunsKey(),
                        v.getVictoryWicketsKey()),
                new TeamStatsCounters.NetRunRate(
                        n(v.getNrrMatches()),
                        n(v.getNrrOwnRuns()),
                        n(v.getNrrOppRuns()),
                        zero(v.getNrrOwnOvers()),
                        zero(v.getNrrOppOvers()),
                        n(v.getNrrLeagues()),
                        n(v.getNrrSeasons()),
                        v.getNrrLeagueId(),
                        v.getNrrSeasonId()),
                n(v.getBothInnings()));
    }

    private static long n(Long value) {
        return value == null ? 0L : value;
    }

    private static BigDecimal zero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
