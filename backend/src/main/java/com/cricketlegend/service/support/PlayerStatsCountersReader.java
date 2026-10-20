package com.cricketlegend.service.support;

import com.cricketlegend.repository.PlayerStatsAggregateRepository.PlayerStatsAggregateView;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * docs/specs/103-player-stats.md: turns one row of the aggregate query into {@link PlayerStatsCounters}. Shared by the
 * player statistics and leaderboard services so both feed {@link PlayerStatsCalculator} identically (parity). It copies
 * numbers and decodes nothing else; no figure is computed here.
 */
public final class PlayerStatsCountersReader {

    private PlayerStatsCountersReader() {}

    public static PlayerStatsCounters toCounters(PlayerStatsAggregateView v) {
        return new PlayerStatsCounters(
                n(v.getMatches()),
                n(v.getResultsWithBattingCard()),
                n(v.getResultsWithBowlingCard()),
                new PlayerStatsCounters.Batting(
                        n(v.getBatInnings()),
                        n(v.getBatNotOuts()),
                        n(v.getBatDismissals()),
                        n(v.getBatRuns()),
                        n(v.getBatBallsFaced()),
                        n(v.getBatInningsWithBalls()),
                        n(v.getBatRunsWithBalls()),
                        n(v.getBatFours()),
                        n(v.getBatSixes()),
                        n(v.getBatInningsWithBoundaries()),
                        n(v.getBatBoundaryRuns()),
                        n(v.getBatRunsWithBoundaries()),
                        n(v.getBatBallsForBoundaries()),
                        n(v.getBatBoundaryCount()),
                        n(v.getBatDucks()),
                        n(v.getBatGoldenDucks()),
                        n(v.getBatThirtyPlus()),
                        n(v.getBatFiftyPlus()),
                        n(v.getBatHundredPlus()),
                        n(v.getBatCenturies()),
                        n(v.getBatHalfCenturies()),
                        v.getBatHighestKey()),
                new PlayerStatsCounters.Bowling(
                        n(v.getBowlInnings()),
                        n(v.getBowlBalls()),
                        n(v.getBowlRuns()),
                        n(v.getBowlWickets()),
                        n(v.getBowlMaidens()),
                        n(v.getBowlWides()),
                        n(v.getBowlNoBalls()),
                        n(v.getBowlDots()),
                        n(v.getBowlInningsWithWides()),
                        n(v.getBowlInningsWithNoBalls()),
                        n(v.getBowlInningsWithDots()),
                        n(v.getBowlBallsWithDots()),
                        v.getBowlOvers() == null ? BigDecimal.ZERO : v.getBowlOvers(),
                        ballsPerOver(v.getBowlBallsPerOver()),
                        n(v.getBowlThreeWickets()),
                        n(v.getBowlFourWickets()),
                        n(v.getBowlFiveWickets()),
                        v.getBowlBestKey()),
                new PlayerStatsCounters.Fielding(
                        n(v.getFieldCatches()), n(v.getFieldStumpings()), n(v.getFieldRunOuts())),
                new PlayerStatsCounters.Awards(n(v.getAwardPlayerOfMatch()), n(v.getAwardTeamPlayerOfMatch())),
                new PlayerStatsCounters.Record(
                        n(v.getRecWon()), n(v.getRecLost()), n(v.getRecTied()), n(v.getRecDrawn()), n(v.getRecInternal())));
    }

    private static List<Integer> ballsPerOver(String csv) {
        if (csv == null || csv.isBlank()) {
            return List.of();
        }
        List<Integer> values = new ArrayList<>();
        for (String part : csv.split(",")) {
            values.add(Integer.valueOf(part.trim()));
        }
        values.sort(Integer::compare);
        return values;
    }

    private static long n(Long value) {
        return value == null ? 0L : value;
    }

    private static long n(Integer value) {
        return value == null ? 0L : value;
    }
}
