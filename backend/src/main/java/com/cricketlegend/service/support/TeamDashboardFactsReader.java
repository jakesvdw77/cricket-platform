package com.cricketlegend.service.support;

import com.cricketlegend.repository.TeamStatsFactsRepository.TeamDashboardResultView;
import java.time.Instant;

/**
 * docs/specs/117-stats-dashboard.md: turns a row of the team Dashboard query into the plain input of {@link
 * TeamDashboardSeriesBuilder}, so the builder stays free of repository types. It copies values; nothing is decided here.
 */
public final class TeamDashboardFactsReader {

    private TeamDashboardFactsReader() {}

    public static TeamDashboardSeriesBuilder.ResultFact toFact(TeamDashboardResultView v) {
        return new TeamDashboardSeriesBuilder.ResultFact(
                v.getResultId(),
                v.getMatchId(),
                Instant.ofEpochMilli(v.getMatchEpochMillis()),
                v.getOpponentName(),
                Boolean.TRUE.equals(v.getDerby()),
                v.getOutcome(),
                v.getWinningSide(),
                v.getSide(),
                n(v.getOppInnings()),
                n(v.getOwnUsable()),
                n(v.getOppUsable()),
                v.getOwnRuns(),
                v.getOwnWickets(),
                v.getOwnBalls(),
                v.getOwnRunsWithBalls(),
                v.getOwnOvers(),
                v.getOppRuns(),
                v.getOppWickets(),
                v.getOppBalls(),
                v.getOppRunsWithBalls(),
                v.getOppOvers(),
                v.getExtras(),
                v.getWides(),
                v.getNoBalls(),
                v.getByes(),
                v.getLegByes(),
                v.getPenaltyRuns(),
                v.getBowlBalls(),
                v.getBowlDots(),
                n(v.getBowlRows()),
                n(v.getBowlDotsRows()),
                Boolean.TRUE.equals(v.getNrrUsable()),
                n(v.getNrrOwnRuns()),
                n(v.getNrrOppRuns()),
                v.getNrrOwnOvers(),
                v.getNrrOppOvers());
    }

    private static long n(Long value) {
        return value == null ? 0L : value;
    }
}
