package com.cricketlegend.service.support;

import com.cricketlegend.service.support.LeaderboardRanker.Candidate;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Hand-built {@link PlayerStatsCounters} for the statistics unit tests (docs/specs/103-player-stats.md Test Plan). Every
 * field starts at zero; a test sets only what the case is about. Not a production class, no Spring.
 */
final class PlayerStatsTestData {

    private static final AtomicLong IDS = new AtomicLong();

    private PlayerStatsTestData() {}

    static Counters counters() {
        return new Counters();
    }

    /** A candidate whose figures come from the calculator, as in production. */
    static Candidate candidate(String firstName, Counters c) {
        return candidate(firstName, c.build());
    }

    static Candidate candidate(String firstName, PlayerStatsCounters counters) {
        return new Candidate(
                new UUID(0, IDS.incrementAndGet()),
                firstName,
                "Player",
                true,
                counters,
                PlayerStatsCalculator.calculate(counters, PlayerStatsFacts.EMPTY));
    }

    /** Mutable builder over every counter. */
    static final class Counters {
        long matches;
        long resultsWithBattingCard;
        long resultsWithBowlingCard;

        long innings;
        long notOuts;
        long dismissals;
        long runs;
        long ballsFaced;
        long inningsWithBalls;
        long runsWithBalls;
        long fours;
        long sixes;
        long inningsWithBoundaries;
        long boundaryRuns;
        long runsWithBoundaries;
        long ballsForBoundaries;
        long boundaryCount;
        long ducks;
        long goldenDucks;
        long thirtyPlus;
        long fiftyPlus;
        long hundredPlus;
        long centuries;
        long halfCenturies;
        Long highestScoreKey;

        long inningsBowled;
        long balls;
        long runsConceded;
        long wickets;
        long maidens;
        long wides;
        long noBalls;
        long dots;
        long inningsWithWides;
        long inningsWithNoBalls;
        long inningsWithDots;
        long ballsWithDots;
        BigDecimal overs = BigDecimal.ZERO;
        List<Integer> ballsPerOver = List.of();
        long threeW;
        long fourW;
        long fiveW;
        Long bestBowlingKey;

        long catches;
        long stumpings;
        long runOuts;

        long potm;
        long teamPotm;

        long won;
        long lost;
        long tied;
        long drawn;
        long internal;

        Counters matches(long v) {
            matches = v;
            return this;
        }

        /** Batting: innings with the given dismissals (the rest not out) and runs. */
        Counters bat(long inningsCount, long dismissalCount, long runCount) {
            innings = inningsCount;
            dismissals = dismissalCount;
            notOuts = inningsCount - dismissalCount;
            runs = runCount;
            if (matches < inningsCount) {
                matches = inningsCount;
            }
            return this;
        }

        /** Balls recorded on {@code inningsCount} innings that scored {@code runCount} between them. */
        Counters ballsOn(long inningsCount, long runCount, long ballCount) {
            inningsWithBalls = inningsCount;
            runsWithBalls = runCount;
            ballsFaced = ballCount;
            return this;
        }

        Counters highest(long score, boolean notOut) {
            highestScoreKey = PlayerStatsCalculator.highestScoreKey(score, notOut);
            return this;
        }

        Counters milestones(long thirty, long fifty, long hundred) {
            thirtyPlus = thirty;
            fiftyPlus = fifty;
            hundredPlus = hundred;
            return this;
        }

        Counters fours(long v) {
            fours = v;
            return this;
        }

        Counters sixes(long v) {
            sixes = v;
            return this;
        }

        /** Bowling: balls (6 per over unless {@link #overs} is set), runs, wickets over {@code inningsCount} innings. */
        Counters bowl(long inningsCount, long ballCount, long runCount, long wicketCount) {
            inningsBowled = inningsCount;
            balls = ballCount;
            runsConceded = runCount;
            wickets = wicketCount;
            overs = BigDecimal.valueOf(ballCount).divide(BigDecimal.valueOf(6), 10, java.math.RoundingMode.HALF_UP);
            ballsPerOver = ballCount > 0 ? List.of(6) : List.of();
            if (matches < inningsCount) {
                matches = inningsCount;
            }
            return this;
        }

        Counters overs(String value) {
            overs = new BigDecimal(value);
            return this;
        }

        Counters ballsPerOver(Integer... values) {
            ballsPerOver = List.of(values);
            return this;
        }

        Counters dots(long inningsCount, long dotCount, long ballsOfThoseInnings) {
            inningsWithDots = inningsCount;
            dots = dotCount;
            ballsWithDots = ballsOfThoseInnings;
            return this;
        }

        Counters hauls(long three, long four, long five) {
            threeW = three;
            fourW = four;
            fiveW = five;
            return this;
        }

        Counters best(long wicketCount, long runCount, long ballCount) {
            bestBowlingKey = PlayerStatsCalculator.bestBowlingKey(wicketCount, runCount, ballCount);
            return this;
        }

        Counters fielding(long catchCount, long stumpingCount, long runOutCount) {
            catches = catchCount;
            stumpings = stumpingCount;
            runOuts = runOutCount;
            return this;
        }

        Counters awards(long official, long team) {
            potm = official;
            teamPotm = team;
            return this;
        }

        PlayerStatsCounters build() {
            return new PlayerStatsCounters(
                    matches,
                    resultsWithBattingCard,
                    resultsWithBowlingCard,
                    new PlayerStatsCounters.Batting(
                            innings, notOuts, dismissals, runs, ballsFaced, inningsWithBalls, runsWithBalls, fours,
                            sixes, inningsWithBoundaries, boundaryRuns, runsWithBoundaries, ballsForBoundaries,
                            boundaryCount, ducks, goldenDucks, thirtyPlus, fiftyPlus, hundredPlus, centuries,
                            halfCenturies, highestScoreKey),
                    new PlayerStatsCounters.Bowling(
                            inningsBowled, balls, runsConceded, wickets, maidens, wides, noBalls, dots,
                            inningsWithWides, inningsWithNoBalls, inningsWithDots, ballsWithDots, overs, ballsPerOver,
                            threeW, fourW, fiveW, bestBowlingKey),
                    new PlayerStatsCounters.Fielding(catches, stumpings, runOuts),
                    new PlayerStatsCounters.Awards(potm, teamPotm),
                    new PlayerStatsCounters.Record(won, lost, tied, drawn, internal));
        }
    }
}
