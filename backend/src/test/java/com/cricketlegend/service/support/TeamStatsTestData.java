package com.cricketlegend.service.support;

import com.cricketlegend.service.support.TeamTableRanker.Candidate;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Hand-built {@link TeamStatsCounters} for the team statistics unit tests (docs/specs/116-team-stats.md Test Plan). Every
 * field starts at zero; a test sets only what the case is about. The key encoders restate the layout documented on {@code
 * TeamStatsSql} independently of {@link TeamStatsCalculator}, so a decode bug cannot hide behind a matching encode bug.
 * Not a production class, no Spring.
 */
final class TeamStatsTestData {

    private static final AtomicLong IDS = new AtomicLong();

    private TeamStatsTestData() {}

    static Counters counters() {
        return new Counters();
    }

    /** A candidate whose figures come from the calculator, as in production. */
    static Candidate candidate(String name, Counters c) {
        return new Candidate(
                new UUID(0, IDS.incrementAndGet()), name, "Section", true, TeamStatsCalculator.calculate(c.build()));
    }

    // ---- key encoders (TeamStatsSql, "Encoded keys") ----

    static BigDecimal highKey(long runs, long wickets, boolean allOut, long epoch) {
        return num(BigInteger.valueOf(runs).multiply(pow(13))
                .add(BigInteger.valueOf(epoch).multiply(pow(3)))
                .add(BigInteger.valueOf(allOut ? 100 : 0))
                .add(BigInteger.valueOf(wickets)));
    }

    static BigDecimal lowKey(long runs, long wickets, boolean allOut, long epoch) {
        return highKey(runs, wickets, allOut, 9_999_999_999L - epoch);
    }

    static BigDecimal chaseKey(long runs, long target, long wickets, long epoch) {
        return num(BigInteger.valueOf(runs).multiply(pow(21))
                .add(BigInteger.valueOf(epoch).multiply(pow(11)))
                .add(BigInteger.valueOf(target).multiply(pow(2)))
                .add(BigInteger.valueOf(wickets)));
    }

    static BigDecimal victoryRunsKey(long margin, long epoch) {
        return num(BigInteger.valueOf(margin).multiply(pow(10)).add(BigInteger.valueOf(epoch)));
    }

    /** {@code ballsRemaining} null encodes "unknown" as 0; a known value is stored plus one. */
    static BigDecimal victoryWicketsKey(long margin, Long ballsRemaining, long epoch) {
        long remaining = ballsRemaining == null ? 0 : ballsRemaining + 1;
        return num(BigInteger.valueOf(margin).multiply(pow(18))
                .add(BigInteger.valueOf(remaining).multiply(pow(10)))
                .add(BigInteger.valueOf(epoch)));
    }

    private static BigInteger pow(int exponent) {
        return BigInteger.TEN.pow(exponent);
    }

    private static BigDecimal num(BigInteger value) {
        return new BigDecimal(value);
    }

    /** Mutable builder over every counter. */
    static final class Counters {
        long results;
        long won;
        long lost;
        long tied;
        long drawn;
        long noResult;
        long forfeitsReceived;
        long forfeitsConceded;
        long internal;
        long noBallBowled;
        long bothInnings;

        long ownInnings;
        long ownUsable;
        long ownRuns;
        long ownWickets;
        long ownBalls;
        long ownRunsWithBalls;
        BigDecimal ownOvers = BigDecimal.ZERO;
        long highLowInnings;
        long lowClassifiable;

        long oppInnings;
        long oppUsable;
        long oppRuns;
        long oppWickets;
        long oppBalls;
        long oppRunsWithBalls;
        BigDecimal oppOvers = BigDecimal.ZERO;

        TeamStatsCounters.Component extrasTotal = new TeamStatsCounters.Component(0, 0);
        TeamStatsCounters.Component wides = new TeamStatsCounters.Component(0, 0);
        TeamStatsCounters.Component noBalls = new TeamStatsCounters.Component(0, 0);
        TeamStatsCounters.Component byes = new TeamStatsCounters.Component(0, 0);
        TeamStatsCounters.Component legByes = new TeamStatsCounters.Component(0, 0);
        TeamStatsCounters.Component penalty = new TeamStatsCounters.Component(0, 0);

        BigDecimal highTotalKey;
        BigDecimal lowTotalKey;
        BigDecimal chaseKey;
        BigDecimal victoryRunsKey;
        BigDecimal victoryWicketsKey;

        long nrrMatches;
        long nrrOwnRuns;
        long nrrOppRuns;
        BigDecimal nrrOwnOvers = BigDecimal.ZERO;
        BigDecimal nrrOppOvers = BigDecimal.ZERO;
        long nrrLeagues;
        long nrrSeasons;
        UUID nrrLeagueId;
        UUID nrrSeasonId;

        /** The record of regular results; {@code results} is the sum (forfeits are added by {@link #forfeits}). */
        Counters record(long won, long lost, long tied, long drawn, long noResult) {
            this.won = won;
            this.lost = lost;
            this.tied = tied;
            this.drawn = drawn;
            this.noResult = noResult;
            this.results = won + lost + tied + drawn + noResult + forfeitsReceived + forfeitsConceded;
            return this;
        }

        Counters forfeits(long received, long conceded) {
            results += received + conceded - forfeitsReceived - forfeitsConceded;
            forfeitsReceived = received;
            forfeitsConceded = conceded;
            return this;
        }

        /** Own usable innings (all with balls): runs, wickets, balls and overs faced. */
        Counters bat(long usable, long runs, long wickets, long balls, String overs) {
            ownInnings = Math.max(ownInnings, usable);
            ownUsable = usable;
            ownRuns = runs;
            ownWickets = wickets;
            ownBalls = balls;
            ownRunsWithBalls = balls > 0 ? runs : 0;
            ownOvers = new BigDecimal(overs);
            return this;
        }

        /** Opposition usable innings (all with balls). */
        Counters bowl(long usable, long runs, long wickets, long balls, String overs) {
            oppInnings = Math.max(oppInnings, usable);
            oppUsable = usable;
            oppRuns = runs;
            oppWickets = wickets;
            oppBalls = balls;
            oppRunsWithBalls = balls > 0 ? runs : 0;
            oppOvers = new BigDecimal(overs);
            return this;
        }

        Counters nrr(long matches, long ownRuns, String ownOvers, long oppRuns, String oppOvers, long leagues, long seasons) {
            nrrMatches = matches;
            nrrOwnRuns = ownRuns;
            nrrOwnOvers = new BigDecimal(ownOvers);
            nrrOppRuns = oppRuns;
            nrrOppOvers = new BigDecimal(oppOvers);
            nrrLeagues = leagues;
            nrrSeasons = seasons;
            nrrLeagueId = leagues == 1 ? new UUID(1, 1) : null;
            nrrSeasonId = seasons == 1 ? new UUID(2, 2) : null;
            return this;
        }

        TeamStatsCounters build() {
            return new TeamStatsCounters(
                    new TeamStatsCounters.Results(
                            results, won, lost, tied, drawn, noResult, forfeitsReceived, forfeitsConceded, internal,
                            noBallBowled),
                    new TeamStatsCounters.Innings(
                            ownInnings, ownUsable, ownRuns, ownWickets, ownBalls, ownRunsWithBalls, ownOvers,
                            highLowInnings, lowClassifiable),
                    new TeamStatsCounters.Innings(
                            oppInnings, oppUsable, oppRuns, oppWickets, oppBalls, oppRunsWithBalls, oppOvers, 0, 0),
                    new TeamStatsCounters.Extras(extrasTotal, wides, noBalls, byes, legByes, penalty),
                    new TeamStatsCounters.Keys(
                            highTotalKey, lowTotalKey, chaseKey, victoryRunsKey, victoryWicketsKey),
                    new TeamStatsCounters.NetRunRate(
                            nrrMatches, nrrOwnRuns, nrrOppRuns, nrrOwnOvers, nrrOppOvers, nrrLeagues, nrrSeasons,
                            nrrLeagueId, nrrSeasonId),
                    bothInnings);
        }
    }
}
