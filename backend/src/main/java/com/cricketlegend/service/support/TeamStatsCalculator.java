package com.cricketlegend.service.support;

import com.cricketlegend.dto.MyTeamStatsDto;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * docs/specs/116-team-stats.md, "Precise definitions": the one place a team statistic is defined. Pure: it turns one team's
 * additive {@link TeamStatsCounters} into every derived figure, so the team table, the team page and the tests can never
 * disagree. No Spring, no repository, no entity, no caller or access information.
 *
 * <p>Rounding is {@link RoundingMode#HALF_UP} applied once, at the division that produces the figure (the two rates of Net
 * Run Rate are held to 40 decimals before their difference is rounded to 2 decimals, owner decision 2026-10-21). A figure
 * with no valid denominator is {@code null}, never 0, infinity or NaN. Innings that are not usable (runs, wickets or balls
 * missing) are already left out of the counters and only appear in the coverage.
 */
public final class TeamStatsCalculator {

    /** The rule printed beside every Net Run Rate (116 decision 13). */
    public static final String NRR_RULE = "FULL_QUOTA";

    /** One statistic the data does not support yet; removing an item when capture lands is a one-line change here. */
    public record NotCaptured(String code, String label, String reason) {
    }

    /** The statistics the data does not support yet (116 Non-goals), in one list. */
    public static final List<NotCaptured> NOT_CAPTURED = List.of(new NotCaptured(
            "PARTNERSHIPS", "Partnerships (runs by wicket)", "The scorecard does not record the fall of wickets."));

    /** Whether Net Run Rate is shown, and why not. */
    public enum NrrStatus {
        SHOWN,
        NOT_ONE_COMPETITION,
        NO_USABLE_RESULTS
    }

    /** The figures of one team; the service wraps them with the team and the echoed scope. */
    public record Figures(
            Basis basis,
            Record record,
            Batting batting,
            Chasing chasing,
            Bowling bowling,
            Extras extras,
            NetRunRate netRunRate,
            List<NotCaptured> notCaptured) {
    }

    /**
     * What was counted and what was disclosed. {@code resultsCounted}: counted team results (forfeits included);
     * {@code resultsNoBallBowled}: left out for want of a ball; {@code forfeitsReceived}/{@code forfeitsConceded}: counted
     * forfeits; {@code resultsWithBothInnings}: counted results with a usable innings on each side.
     */
    public record Basis(
            long resultsCounted,
            long internalResults,
            long resultsNoBallBowled,
            long forfeitsReceived,
            long forfeitsConceded,
            long resultsWithBothInnings) {
    }

    /** The record; a forfeit is a win for the side that received it and a loss for the side that conceded it. */
    public record Record(
            long played,
            long won,
            long lost,
            long tied,
            long drawn,
            long noResult,
            long decisive,
            BigDecimal winPercent) {
    }

    /** An innings total with the match date (the match itself is a page fact). */
    public record Total(long runs, long wickets, boolean allOut, Instant matchDate) {
    }

    /** {@code inningsUsable}/{@code inningsCounted}: usable and all own innings; {@code inningsClassifiable}: for the lowest total. */
    public record BattingCoverage(long inningsUsable, long inningsCounted, long inningsClassifiable) {
    }

    public record Batting(
            Long runs,
            Long wicketsLost,
            long innings,
            BigDecimal runsPerInnings,
            BigDecimal battingAverage,
            BigDecimal runRate,
            Long ballsFaced,
            Total highestTotal,
            Total lowestTotal,
            BattingCoverage coverage) {
    }

    public record Chase(long runs, long target, long wickets, Instant matchDate) {
    }

    public record VictoryByRuns(long margin, Instant matchDate) {
    }

    /** {@code ballsRemaining} is null when the chase innings or the scheduled quota is unknown. */
    public record VictoryByWickets(long margin, Long ballsRemaining, Instant matchDate) {
    }

    public record Chasing(Chase highestSuccessfulChase, VictoryByRuns largestVictoryByRuns, VictoryByWickets largestVictoryByWickets) {
    }

    public record BowlingCoverage(long inningsUsable, long inningsCounted) {
    }

    public record Bowling(
            Long wicketsTaken,
            Long runsConceded,
            Long ballsBowled,
            BigDecimal bowlingAverage,
            BigDecimal economy,
            BowlingCoverage coverage) {
    }

    /** One extras figure with its own coverage: {@code inningsRecorded} of {@code inningsCounted} opposition innings. */
    public record ExtrasFigure(Long value, long inningsRecorded, long inningsCounted) {
    }

    public record Extras(
            Long conceded,
            BigDecimal averagePerMatch,
            ExtrasFigure total,
            ExtrasFigure wides,
            ExtrasFigure noBalls,
            ExtrasFigure byes,
            ExtrasFigure legByes,
            ExtrasFigure penaltyRuns) {
    }

    /** {@code value} is set only when {@code status} is SHOWN; {@code matchesUsed} of {@code matchesCounted} results fed it. */
    public record NetRunRate(
            NrrStatus status,
            BigDecimal value,
            String rule,
            long matchesUsed,
            long matchesCounted,
            UUID leagueId,
            UUID seasonId) {
    }

    /** How one counted result reads for the team on the form strip. */
    public enum FormResult {
        WON,
        LOST,
        TIED,
        DRAWN,
        NO_RESULT
    }

    /** One result for the form strip; {@code forfeit} marks a win or loss by forfeit (no scores). */
    public record FormLine(FormResult result, boolean forfeit) {
    }

    private static final BigInteger TEN = BigInteger.TEN;

    private TeamStatsCalculator() {}

    public static Figures calculate(TeamStatsCounters c) {
        TeamStatsCounters.Results r = c.results();
        long resultsWithInnings = r.results() - r.forfeitsReceived() - r.forfeitsConceded();
        Basis basis = new Basis(
                r.results(),
                r.internal(),
                r.noBallBowled(),
                r.forfeitsReceived(),
                r.forfeitsConceded(),
                c.resultsWithBothInnings());
        return new Figures(
                basis,
                record(r),
                batting(c),
                chasing(c.keys()),
                bowling(c),
                extras(c),
                netRunRate(c.netRunRate(), resultsWithInnings),
                NOT_CAPTURED);
    }

    // ---- form ----

    /**
     * How a counted result reads for the team on {@code side} (the same rules as the record: a forfeit is a win for the
     * side that received it, {@code winningSide}, and a loss for the other).
     */
    public static FormLine formLine(String outcome, String winningSide, String side) {
        return switch (outcome) {
            case "WON" -> new FormLine(side.equals(winningSide) ? FormResult.WON : FormResult.LOST, false);
            case "FORFEIT" -> new FormLine(side.equals(winningSide) ? FormResult.WON : FormResult.LOST, true);
            case "TIE" -> new FormLine(FormResult.TIED, false);
            case "DRAW" -> new FormLine(FormResult.DRAWN, false);
            case "NO_RESULT", "ABANDONED" -> new FormLine(FormResult.NO_RESULT, false);
            default -> throw new IllegalArgumentException("A counted result has an outcome that no team rule covers.");
        };
    }

    // ---- record ----

    private static Record record(TeamStatsCounters.Results r) {
        long won = r.won() + r.forfeitsReceived();
        long lost = r.lost() + r.forfeitsConceded();
        long decisive = won + lost;
        long played = decisive + r.tied() + r.drawn() + r.noResult();
        return new Record(played, won, lost, r.tied(), r.drawn(), r.noResult(), decisive, ratio(won * 100, decisive, 1));
    }

    // ---- batting ----

    private static Batting batting(TeamStatsCounters c) {
        TeamStatsCounters.Innings own = c.own();
        boolean any = own.usable() > 0;
        return new Batting(
                any ? own.runs() : null,
                any ? own.wickets() : null,
                own.usable(),
                any ? ratio(own.runs(), own.usable(), 2) : null,
                any ? ratio(own.runs(), own.wickets(), 2) : null,
                ratio(own.runsWithBalls(), own.overs(), 2),
                any ? own.balls() : null,
                total(c.keys().highTotal(), false),
                total(c.keys().lowTotal(), true),
                new BattingCoverage(own.usable(), own.innings(), own.lowClassifiable()));
    }

    /** Decodes the highest or lowest total key (see {@code TeamStatsSql}); the lowest key stores the date inverted. */
    private static Total total(BigDecimal key, boolean inverted) {
        if (key == null) {
            return null;
        }
        BigInteger k = key.toBigIntegerExact();
        long runs = digits(k, 13, 12).longValue();
        long epoch = digits(k, 3, 10).longValue();
        boolean allOut = digits(k, 2, 1).longValue() == 1;
        long wickets = digits(k, 0, 2).longValue();
        return new Total(runs, wickets, allOut, Instant.ofEpochSecond(inverted ? 9_999_999_999L - epoch : epoch));
    }

    // ---- chasing and victories ----

    private static Chasing chasing(TeamStatsCounters.Keys keys) {
        Chase chase = null;
        if (keys.chase() != null) {
            BigInteger k = keys.chase().toBigIntegerExact();
            chase = new Chase(
                    digits(k, 21, 12).longValue(),
                    digits(k, 2, 9).longValue(),
                    digits(k, 0, 2).longValue(),
                    Instant.ofEpochSecond(digits(k, 11, 10).longValue()));
        }
        VictoryByRuns byRuns = null;
        if (keys.victoryByRuns() != null) {
            BigInteger k = keys.victoryByRuns().toBigIntegerExact();
            byRuns = new VictoryByRuns(digits(k, 10, 8).longValue(), Instant.ofEpochSecond(digits(k, 0, 10).longValue()));
        }
        VictoryByWickets byWickets = null;
        if (keys.victoryByWickets() != null) {
            BigInteger k = keys.victoryByWickets().toBigIntegerExact();
            long remainingPlusOne = digits(k, 10, 8).longValue();
            byWickets = new VictoryByWickets(
                    digits(k, 18, 4).longValue(),
                    remainingPlusOne == 0 ? null : remainingPlusOne - 1,
                    Instant.ofEpochSecond(digits(k, 0, 10).longValue()));
        }
        return new Chasing(chase, byRuns, byWickets);
    }

    /** The {@code width} decimal digits of {@code key} starting at 10^{@code shift}. */
    private static BigInteger digits(BigInteger key, int shift, int width) {
        return key.divide(TEN.pow(shift)).mod(TEN.pow(width));
    }

    // ---- bowling ----

    private static Bowling bowling(TeamStatsCounters c) {
        TeamStatsCounters.Innings opp = c.opposition();
        boolean any = opp.usable() > 0;
        return new Bowling(
                any ? opp.wickets() : null,
                any ? opp.runs() : null,
                any ? opp.balls() : null,
                any ? ratio(opp.runs(), opp.wickets(), 2) : null,
                ratio(opp.runsWithBalls(), opp.overs(), 2),
                new BowlingCoverage(opp.usable(), opp.innings()));
    }

    // ---- extras ----

    private static Extras extras(TeamStatsCounters c) {
        long counted = c.opposition().innings();
        TeamStatsCounters.Extras e = c.extras();
        return new Extras(
                e.total().innings() > 0 ? e.total().sum() : null,
                ratio(e.total().sum(), e.total().innings(), 2),
                figure(e.total(), counted),
                figure(e.wides(), counted),
                figure(e.noBalls(), counted),
                figure(e.byes(), counted),
                figure(e.legByes(), counted),
                figure(e.penalty(), counted));
    }

    private static ExtrasFigure figure(TeamStatsCounters.Component component, long counted) {
        return new ExtrasFigure(component.innings() > 0 ? component.sum() : null, component.innings(), counted);
    }

    // ---- net run rate ----

    private static NetRunRate netRunRate(TeamStatsCounters.NetRunRate n, long matchesCounted) {
        if (n.matches() == 0 || n.ownOvers().signum() <= 0 || n.oppOvers().signum() <= 0) {
            return new NetRunRate(NrrStatus.NO_USABLE_RESULTS, null, NRR_RULE, n.matches(), matchesCounted, null, null);
        }
        if (n.leagues() > 1 || n.seasons() > 1) {
            return new NetRunRate(NrrStatus.NOT_ONE_COMPETITION, null, NRR_RULE, n.matches(), matchesCounted, null, null);
        }
        return new NetRunRate(
                NrrStatus.SHOWN,
                nrrValue(n.ownRuns(), n.ownOvers(), n.oppRuns(), n.oppOvers()),
                NRR_RULE,
                n.matches(),
                matchesCounted,
                n.leagueId(),
                n.seasonId());
    }

    /**
     * Net Run Rate (116): the two run rates held to 40 decimals before their difference is rounded to 2 decimals, HALF_UP
     * once; null when either side has no overs. The page's Net run rate and the Dashboard's running values come from here.
     */
    public static BigDecimal nrrValue(long ownRuns, BigDecimal ownOvers, long oppRuns, BigDecimal oppOvers) {
        if (ownOvers == null || ownOvers.signum() <= 0 || oppOvers == null || oppOvers.signum() <= 0) {
            return null;
        }
        BigDecimal scored = BigDecimal.valueOf(ownRuns).divide(ownOvers, 40, RoundingMode.HALF_UP);
        BigDecimal conceded = BigDecimal.valueOf(oppRuns).divide(oppOvers, 40, RoundingMode.HALF_UP);
        return scored.subtract(conceded).setScale(2, RoundingMode.HALF_UP);
    }

    // ---- docs/specs/117-stats-dashboard.md: single-result definitions the Dashboard series call ----

    /** A run rate (116): runs per over to 2 decimals, HALF_UP once; null when there are no overs. */
    public static BigDecimal rate(long runs, BigDecimal overs) {
        return ratio(runs, overs, 2);
    }

    /**
     * A running runs / overs total across matches (spec 117 decision 3: running values live in the calculators). A null
     * runs or overs figure counts as zero.
     */
    public static final class RunningRate {
        private long runs;
        private BigDecimal overs = BigDecimal.ZERO;

        public RunningRate add(Long matchRuns, BigDecimal matchOvers) {
            runs += matchRuns == null ? 0L : matchRuns;
            overs = overs.add(matchOvers == null ? BigDecimal.ZERO : matchOvers);
            return this;
        }

        public long runs() {
            return runs;
        }

        public BigDecimal overs() {
            return overs;
        }

        /** The running run rate (2 decimals), null while there are no overs. */
        public BigDecimal rate() {
            return TeamStatsCalculator.rate(runs, overs);
        }
    }

    /** The running net run rate of two running totals (own minus conceded), null when either has no overs. */
    public static BigDecimal runningNrr(RunningRate own, RunningRate opposition) {
        return nrrValue(own.runs(), own.overs(), opposition.runs(), opposition.overs());
    }

    /**
     * The dot-ball figures pooled over the charted matches (spec 117): totals, the pooled percentage and the percentage-point
     * weights the trend hint uses ({@code dots x 100 / balls}, so the flat band is in points).
     */
    public static final class DotsPool {
        private long charted;
        private long dots;
        private long balls;
        private final List<StatsTrend.Weighted> weighted = new ArrayList<>();

        /** Adds one match; a match without a percentage (no dots figure or no balls) is skipped. */
        public void add(DotsPoint point) {
            if (point.percent() == null) {
                return;
            }
            charted++;
            dots += point.dots();
            balls += point.ballsBowled();
            weighted.add(new StatsTrend.Weighted(
                    BigDecimal.valueOf(point.dots()).multiply(BigDecimal.valueOf(100)),
                    BigDecimal.valueOf(point.ballsBowled())));
        }

        public long charted() {
            return charted;
        }

        public BigDecimal percent() {
            return dotPercent(dots, balls);
        }

        public List<StatsTrend.Weighted> weighted() {
            return weighted;
        }
    }

    /** A dot-ball percentage (103): {@code dots / balls x 100} to 1 decimal, HALF_UP once; null without balls. */
    public static BigDecimal dotPercent(long dots, long balls) {
        return ratio(dots * 100, balls, 1);
    }

    /**
     * One innings' dot balls (spec 117): {@code ballsBowled} is the sum of our bowler rows' balls (null without bowler rows);
     * {@code dots} is their sum only when every bowler row that bowled a ball recorded dots ({@code rowsDotted} of {@code
     * rowsBowled}), else null (never a partial sum); {@code percent} is null when {@code dots} is null or no ball was bowled.
     */
    public record DotsPoint(Integer ballsBowled, Integer dots, BigDecimal percent) {
    }

    public static DotsPoint dotsForMatch(Long balls, Long dots, long rowsBowled, long rowsDotted) {
        Integer ballsBowled = balls == null ? null : Math.toIntExact(balls);
        boolean complete = dots != null && rowsDotted == rowsBowled;
        Integer recorded = complete ? Math.toIntExact(dots) : null;
        BigDecimal percent = complete && balls != null ? dotPercent(dots, balls) : null;
        return new DotsPoint(ballsBowled, recorded, percent);
    }

    /**
     * One innings' extras (spec 117): {@code itemised} when any component is recorded; {@code notItemised} is the stored
     * total of an innings that recorded a total but no component; {@code total} is the stored total (null: none recorded).
     */
    public record ExtrasPoint(boolean itemised, Long notItemised, Long total) {
    }

    public static ExtrasPoint extrasForMatch(Long total, Long wides, Long noBalls, Long byes, Long legByes, Long penaltyRuns) {
        boolean itemised = wides != null || noBalls != null || byes != null || legByes != null || penaltyRuns != null;
        // 101: with any component recorded the total is the sum of the recorded components
        Long effective = total;
        if (effective == null && itemised) {
            effective = 0L;
            for (Long component : new Long[] {wides, noBalls, byes, legByes, penaltyRuns}) {
                effective += component == null ? 0L : component;
            }
        }
        return new ExtrasPoint(itemised, !itemised && effective != null ? effective : null, effective);
    }

    // ---- docs/specs/147 slice 3: the Player Hub Team stats figures ----

    /**
     * A close game (spec 147, Open question 9, owner may correct): a regular win or loss decided by fewer than this many
     * runs ...
     */
    public static final int CLOSE_RUNS = 20;

    /** ... or by fewer than this many wickets (a one-wicket finish). A tie is not decided, so it is never close. */
    public static final int CLOSE_WICKETS = 2;

    /** How many named contributors the contribution card lists before the rest fold into Others. */
    public static final int TOP_CONTRIBUTORS = 5;

    /** The kinds of {@link ContributionFact}. */
    public static final String RUNS = "RUNS";

    public static final String WICKETS = "WICKETS";

    private static final String FORFEIT = "FORFEIT";
    private static final String UNNAMED_PLAYER = "Unnamed Player";

    /**
     * One counted team result as stored: the opponent as recorded, the outcome and stored margin, the toss winner and the
     * side that batted first ({@code HOME} or {@code AWAY}, null when not recorded; always null for a forfeit). {@code side}
     * is the team's side. Pure data; every reading of it is below.
     */
    public record ResultFact(
            UUID matchId,
            Instant matchDate,
            String opponentName,
            String outcome,
            String winningSide,
            String side,
            String decidedBy,
            String marginType,
            Long marginValue,
            String tossWonBy,
            String firstBattingSide) {

        boolean forfeit() {
            return FORFEIT.equals(outcome);
        }

        FormLine line() {
            return formLine(outcome, winningSide, side);
        }
    }

    /** {@code played} results of this kind and the {@code won} among them (a tie or draw is played, not won). */
    public record Split(long played, long won) {
    }

    /**
     * Batting first v chasing: {@code recorded} of {@code counted} (non-forfeit) results recorded which side batted first;
     * only those are in the two splits.
     */
    public record BattingOrder(Split battingFirst, Split chasing, long recorded, long counted) {
    }

    /** {@code won} the toss in {@code known} results that recorded it, of {@code counted} non-forfeit results. */
    public record Toss(long won, long known, long counted) {
    }

    /** One meeting with an opponent, for the head-to-head list (oldest first). */
    public record HeadToHeadResult(UUID matchId, Instant matchDate, FormResult result, boolean forfeit) {
    }

    /** One opponent name as recorded (null: none recorded) and every counted result against it, oldest first. */
    public record HeadToHead(
            String opponentName,
            long played,
            long won,
            long lost,
            long tied,
            long drawn,
            long noResult,
            List<HeadToHeadResult> results) {
    }

    /**
     * Close games: {@code played} and {@code won} among the regular decided results whose stored margin is below {@code
     * closeRuns} runs or {@code closeWickets} wickets. {@code decided} are the counted non-forfeit WON-outcome results and
     * {@code withMargin} those of them that stored a margin (a result without one cannot be classified).
     */
    public record CloseGames(long played, long won, int closeRuns, int closeWickets, long decided, long withMargin) {
    }

    /**
     * One of the squad figures: {@code playersUsed} distinct registered players in the counted results' teams (a
     * substitute does not count), {@code guestAppearances} guest or unconfirmed rows, and the average number of players who
     * answered "available" per closed availability poll of those matches (null without a poll), over {@code matchesWithPoll}
     * of {@code counted} non-forfeit results.
     */
    public record Squad(
            long playersUsed, long guestAppearances, BigDecimal averageAvailable, long matchesWithPoll, long counted) {
    }

    /** The additive per-player sums of the contribution query ({@code kind} is {@link #RUNS} or {@link #WICKETS}); a null {@code profileId} is a guest. */
    public record ContributionFact(String kind, UUID profileId, String name, long value) {
    }

    /** How a line of a contribution card reads. */
    public enum ShareKind {
        PLAYER,
        GUESTS,
        OTHERS,
        EXTRAS,
        NOT_ATTRIBUTED
    }

    /** One line of a contribution card; {@code sharePercent} is {@code value} of the block total, 1 decimal, null without a total. */
    public record ShareLine(ShareKind kind, String label, long value, BigDecimal sharePercent) {
    }

    /**
     * Where the runs (or wickets) come from: the {@code total} of the usable innings, its lines (top contributors, Others,
     * Extras, then whatever the scorecards do not attribute), and the coverage ({@code inningsWithCard} of {@code
     * inningsCounted} usable innings had the batting or bowling card).
     */
    public record ShareBlock(Long total, List<ShareLine> lines, long inningsWithCard, long inningsCounted) {
    }

    /** Additive counters of {@code TeamStatsSql#HELD_EXTENT}; see that query for what each counts. */
    public record Extent(
            long ownUsable,
            long ownWithCard,
            long oppUsable,
            long oppWithCard,
            TeamStatsCounters.Extras ownExtras,
            long ownUsableExtrasInnings,
            long ownUsableExtras,
            long ownUsableExtrasRuns,
            long oppUsableExtrasInnings,
            long oppUsableExtras,
            long oppUsableExtrasRuns,
            long playersUsed,
            long guestRows) {

        public static final Extent EMPTY = new Extent(
                0,
                0,
                0,
                0,
                new TeamStatsCounters.Extras(
                        new TeamStatsCounters.Component(0, 0),
                        new TeamStatsCounters.Component(0, 0),
                        new TeamStatsCounters.Component(0, 0),
                        new TeamStatsCounters.Component(0, 0),
                        new TeamStatsCounters.Component(0, 0),
                        new TeamStatsCounters.Component(0, 0)),
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0);
    }

    /**
     * Extras on one side of the Extras card. {@code total} is the stored total (null: none recorded); {@code sharePercent}
     * is those extras over the runs of the same innings (1 decimal, null without them): of the runs conceded for {@code
     * gaveAway}, of the team's runs for {@code received}. Each component has its own coverage; {@code inningsWithExtras} of
     * {@code inningsCounted} innings recorded a total.
     */
    public record ExtrasSide(
            Long total,
            BigDecimal sharePercent,
            ExtrasFigure wides,
            ExtrasFigure noBalls,
            ExtrasFigure byes,
            ExtrasFigure legByes,
            ExtrasFigure penaltyRuns,
            long inningsWithExtras,
            long inningsCounted) {
    }

    /** The Extras card: what the team gave away and received. {@code partly}: some innings did not itemise wides, no-balls, byes and leg byes. */
    public record ExtrasCard(ExtrasSide gaveAway, ExtrasSide received, boolean partly) {
    }

    private static List<ResultFact> played(List<ResultFact> results) {
        return results.stream().filter(r -> !r.forfeit()).toList();
    }

    /** Batting first v chasing from the stored first-innings side (spec 147); a forfeit and a result with no order recorded are left out. */
    public static BattingOrder battingOrder(List<ResultFact> results) {
        long firstPlayed = 0;
        long firstWon = 0;
        long chasePlayed = 0;
        long chaseWon = 0;
        long recorded = 0;
        List<ResultFact> counted = played(results);
        for (ResultFact r : counted) {
            if (r.firstBattingSide() == null) {
                continue;
            }
            recorded++;
            boolean won = r.line().result() == FormResult.WON;
            if (r.firstBattingSide().equals(r.side())) {
                firstPlayed++;
                firstWon += won ? 1 : 0;
            } else {
                chasePlayed++;
                chaseWon += won ? 1 : 0;
            }
        }
        return new BattingOrder(new Split(firstPlayed, firstWon), new Split(chasePlayed, chaseWon), recorded, counted.size());
    }

    /** The toss: won of the results that recorded it. */
    public static Toss toss(List<ResultFact> results) {
        long won = 0;
        long known = 0;
        List<ResultFact> counted = played(results);
        for (ResultFact r : counted) {
            if (r.tossWonBy() == null) {
                continue;
            }
            known++;
            won += r.tossWonBy().equals(r.side()) ? 1 : 0;
        }
        return new Toss(won, known, counted.size());
    }

    /**
     * Head to head per opponent name as recorded (trimmed, otherwise exact; a blank name is none recorded). Results are in
     * date order within an opponent; opponents are ordered by results played (most first), then by name.
     */
    public static List<HeadToHead> headToHead(List<ResultFact> results) {
        Map<String, List<ResultFact>> byOpponent = new LinkedHashMap<>();
        List<ResultFact> ordered = new ArrayList<>(results);
        ordered.sort(Comparator.comparing(ResultFact::matchDate).thenComparing(ResultFact::matchId));
        for (ResultFact r : ordered) {
            String name = r.opponentName() == null || r.opponentName().isBlank() ? null : r.opponentName().trim();
            byOpponent.computeIfAbsent(name, k -> new ArrayList<>()).add(r);
        }
        List<HeadToHead> out = new ArrayList<>();
        byOpponent.forEach((name, list) -> {
            long won = 0;
            long lost = 0;
            long tied = 0;
            long drawn = 0;
            long none = 0;
            List<HeadToHeadResult> rows = new ArrayList<>();
            for (ResultFact r : list) {
                FormLine line = r.line();
                switch (line.result()) {
                    case WON -> won++;
                    case LOST -> lost++;
                    case TIED -> tied++;
                    case DRAWN -> drawn++;
                    case NO_RESULT -> none++;
                }
                rows.add(new HeadToHeadResult(r.matchId(), r.matchDate(), line.result(), line.forfeit()));
            }
            out.add(new HeadToHead(name, list.size(), won, lost, tied, drawn, none, rows));
        });
        out.sort(Comparator.comparingLong(HeadToHead::played)
                .reversed()
                .thenComparing(h -> h.opponentName() == null ? "￿" : h.opponentName().toLowerCase(Locale.ROOT)));
        return out;
    }

    /** Close games (spec 147): regular decided results with a stored margin under {@link #CLOSE_RUNS} runs or {@link #CLOSE_WICKETS} wickets. */
    public static CloseGames closeGames(List<ResultFact> results) {
        long decided = 0;
        long withMargin = 0;
        long close = 0;
        long won = 0;
        for (ResultFact r : played(results)) {
            if (!"WON".equals(r.outcome())) {
                continue;
            }
            decided++;
            if (r.marginType() == null || r.marginValue() == null || !"REGULAR".equals(r.decidedBy())) {
                continue;
            }
            withMargin++;
            boolean isClose = ("RUNS".equals(r.marginType()) && r.marginValue() < CLOSE_RUNS)
                    || ("WICKETS".equals(r.marginType()) && r.marginValue() < CLOSE_WICKETS);
            if (isClose) {
                close++;
                won += r.line().result() == FormResult.WON ? 1 : 0;
            }
        }
        return new CloseGames(close, won, CLOSE_RUNS, CLOSE_WICKETS, decided, withMargin);
    }

    /**
     * The squad figures (spec 147): {@code availableCounts} holds, for each closed availability poll of the counted
     * matches, how many players answered "available". The average is to 1 decimal, null without a poll.
     */
    public static Squad squad(Extent extent, Collection<Long> availableCounts, long countedResults) {
        long sum = 0;
        for (Long n : availableCounts) {
            sum += n == null ? 0L : n;
        }
        return new Squad(
                extent.playersUsed(),
                extent.guestRows(),
                ratio(sum, availableCounts.size(), 1),
                availableCounts.size(),
                countedResults);
    }

    private record Contributor(ShareKind kind, String label, long value) {
    }

    /**
     * Where the runs come from (spec 147): the top {@link #TOP_CONTRIBUTORS} batters by runs (guests grouped as one
     * "Guests" entry that ranks with them; ties by name), the rest as Others, the extras our batters received (when
     * recorded), and last whatever the scorecards do not attribute so the lines add up to the {@code teamRuns} total. A
     * line of no runs is left out. A null {@code teamRuns} (no usable innings) gives no lines.
     */
    public static ShareBlock runsContribution(List<ContributionFact> facts, Extent extent, Long teamRuns) {
        List<ShareLine> lines = contributionLines(facts, RUNS, teamRuns, extent.ownUsableExtrasInnings() > 0
                ? extent.ownUsableExtras()
                : null, "Not Attributed");
        return new ShareBlock(teamRuns, lines, extent.ownWithCard(), extent.ownUsable());
    }

    /**
     * Where the wickets come from: the same shape for bowlers' stored wickets, with no Extras line; wickets no bowler is
     * credited with (run-outs and the like) are the last "Not By A Bowler" line.
     */
    public static ShareBlock wicketsContribution(List<ContributionFact> facts, Extent extent, Long teamWickets) {
        return new ShareBlock(
                teamWickets,
                contributionLines(facts, WICKETS, teamWickets, null, "Not By A Bowler"),
                extent.oppWithCard(),
                extent.oppUsable());
    }

    private static List<ShareLine> contributionLines(
            List<ContributionFact> facts, String kind, Long total, Long extras, String notAttributedLabel) {
        if (total == null) {
            return List.of();
        }
        long guests = 0;
        List<Contributor> pool = new ArrayList<>();
        for (ContributionFact f : facts) {
            if (!kind.equals(f.kind()) || f.value() <= 0) {
                continue;
            }
            if (f.profileId() == null) {
                guests += f.value();
            } else {
                String label = f.name() == null || f.name().isBlank() ? UNNAMED_PLAYER : f.name();
                pool.add(new Contributor(ShareKind.PLAYER, label, f.value()));
            }
        }
        if (guests > 0) {
            pool.add(new Contributor(ShareKind.GUESTS, "Guests", guests));
        }
        pool.sort(Comparator.comparingLong(Contributor::value)
                .reversed()
                .thenComparing(c -> c.label().toLowerCase(Locale.ROOT)));
        List<ShareLine> lines = new ArrayList<>();
        long attributed = 0;
        for (int i = 0; i < Math.min(TOP_CONTRIBUTORS, pool.size()); i++) {
            Contributor c = pool.get(i);
            lines.add(line(c.kind(), c.label(), c.value(), total));
            attributed += c.value();
        }
        if (pool.size() > TOP_CONTRIBUTORS) {
            long others = pool.subList(TOP_CONTRIBUTORS, pool.size()).stream().mapToLong(Contributor::value).sum();
            lines.add(line(ShareKind.OTHERS, "Others", others, total));
            attributed += others;
        }
        if (extras != null) {
            lines.add(line(ShareKind.EXTRAS, "Extras", extras, total));
            attributed += extras;
        }
        if (total - attributed > 0) {
            lines.add(line(ShareKind.NOT_ATTRIBUTED, notAttributedLabel, total - attributed, total));
        }
        return lines;
    }

    private static ShareLine line(ShareKind kind, String label, long value, long total) {
        return new ShareLine(kind, label, value, ratio(value * 100, total, 1));
    }

    /**
     * The Extras card (spec 147): what the team gave away (the opposition innings' extras, the figures of {@link #extras})
     * and what its batters received (the team's own innings), each with its share of the runs of the innings that recorded an
     * extras total and its components with their own coverage.
     */
    public static ExtrasCard extrasCard(TeamStatsCounters c, Extent e) {
        long oppCounted = c.opposition().innings();
        long ownCounted = c.own().innings();
        ExtrasSide gaveAway = extrasSide(c.extras(), oppCounted, e.oppUsableExtras(), e.oppUsableExtrasRuns());
        ExtrasSide received = extrasSide(e.ownExtras(), ownCounted, e.ownUsableExtras(), e.ownUsableExtrasRuns());
        boolean partly = itemisedPartly(gaveAway) || itemisedPartly(received);
        return new ExtrasCard(gaveAway, received, partly);
    }

    private static ExtrasSide extrasSide(TeamStatsCounters.Extras x, long counted, long shareExtras, long shareRuns) {
        return new ExtrasSide(
                x.total().innings() > 0 ? x.total().sum() : null,
                ratio(shareExtras * 100, shareRuns, 1),
                figure(x.wides(), counted),
                figure(x.noBalls(), counted),
                figure(x.byes(), counted),
                figure(x.legByes(), counted),
                figure(x.penalty(), counted),
                x.total().innings(),
                counted);
    }

    private static boolean itemisedPartly(ExtrasSide s) {
        for (ExtrasFigure f : List.of(s.wides(), s.noBalls(), s.byes(), s.legByes())) {
            if (f.inningsRecorded() < f.inningsCounted()) {
                return true;
            }
        }
        return false;
    }

    // ---- docs/specs/147 amendment 3: Team Stats on a par with Player Stats ----

    /** One batting entry of a counted usable own innings; {@code hasEntry} false: the innings has no batting entry (all else null). */
    public record BattingFact(
            UUID matchId,
            int sequence,
            Long inningsRuns,
            boolean hasEntry,
            Integer position,
            Integer runs,
            Integer balls,
            Integer fours,
            Integer sixes,
            String howOut) {
    }

    /** One counted non-forfeit result's playing area ({@code areaId} null: none recorded) and the sums of its usable innings. */
    public record VenueFact(
            UUID matchId,
            UUID areaId,
            String areaName,
            boolean clubField,
            Long ownRuns,
            Long ownWickets,
            Long oppRuns,
            Long oppWickets) {
    }

    /** One stored bowling row of an opposition usable innings and one dismissal type credited against it ({@code bowlingEntryId} null: no bowling row). */
    public record WicketFact(
            UUID matchId, int sequence, UUID bowlingEntryId, Integer wickets, String howOut, long credited) {
    }

    /** Fielding credits of one fielder (profile id null: the guest group) in one result; {@code entries} 0: the result has no fielding record. */
    public record FieldingFact(
            UUID matchId, UUID profileId, String name, long entries, long catches, long stumpings, long runOuts) {
    }

    /** The stored facts the amendment 3 blocks are decided from; rows outside the capped history are ignored. */
    public record HubFacts(
            List<BattingFact> batting, List<VenueFact> venues, List<WicketFact> wickets, List<FieldingFact> fielding) {

        public static final HubFacts EMPTY = new HubFacts(List.of(), List.of(), List.of(), List.of());
    }

    private static final int OPENERS_LAST = 2;
    private static final int TAIL_LAST = 11;
    private static final int VENUE_CAP = 12;
    private static final int FIELDER_CAP = 8;
    private static final String UNKNOWN_VENUE = "Unknown venue";
    private static final String OTHER_VENUES = "Other venues";

    private static java.util.Set<UUID> countedMatches(List<ResultFact> results) {
        java.util.Set<UUID> ids = new java.util.HashSet<>();
        for (ResultFact r : results) {
            if (!r.forfeit()) {
                ids.add(r.matchId());
            }
        }
        return ids;
    }

    private static com.cricketlegend.domain.DismissalType dismissal(String howOut) {
        if (howOut == null) {
            return null;
        }
        try {
            return com.cricketlegend.domain.DismissalType.valueOf(howOut);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static boolean notOutKind(com.cricketlegend.domain.DismissalType t) {
        return t == com.cricketlegend.domain.DismissalType.NOT_OUT
                || t == com.cricketlegend.domain.DismissalType.RETIRED_NOT_OUT;
    }

    private static String inningsKey(UUID matchId, int sequence) {
        return matchId + "/" + sequence;
    }

    private static List<BattingFact> cappedBatting(HubFacts facts, List<ResultFact> results) {
        java.util.Set<UUID> in = countedMatches(results);
        return facts.batting().stream().filter(b -> in.contains(b.matchId())).toList();
    }

    /** A batting row that counts: how-out recorded and the player batted (the player rule of {@code COUNTED_BATTING_ROW}). */
    private static com.cricketlegend.domain.DismissalType countedType(BattingFact b) {
        if (!b.hasEntry()) {
            return null;
        }
        com.cricketlegend.domain.DismissalType t = dismissal(b.howOut());
        return t != null && t.batted() ? t : null;
    }

    private static List<MyTeamStatsDto.MyTeamTypeCount> typeCounts(
            Map<com.cricketlegend.domain.DismissalType, Long> counts, long denominator) {
        List<MyTeamStatsDto.MyTeamTypeCount> list = new ArrayList<>();
        counts.forEach((type, n) -> {
            if (n > 0) {
                list.add(new MyTeamStatsDto.MyTeamTypeCount(
                        type.name(), PlayerDashboardSeriesBuilder.label(type), n, ratio(n * 100, denominator, 1)));
            }
        });
        return list;
    }

    /**
     * How the team's batters got out: the batting rows of the counted usable own innings by how-out (not out and retired
     * not out are {@code notOut}; did not bat is not counted; a row with no how-out is {@code notRecorded}). Each type's
     * percent is its share of {@code notOut + wickets}, all batted innings of the team's batters.
     */
    public static MyTeamStatsDto.MyTeamDismissals dismissals(HubFacts facts, List<ResultFact> results) {
        java.util.Set<String> all = new java.util.HashSet<>();
        java.util.Set<String> recorded = new java.util.HashSet<>();
        long notOut = 0;
        long notRecorded = 0;
        Map<com.cricketlegend.domain.DismissalType, Long> types =
                new java.util.EnumMap<>(com.cricketlegend.domain.DismissalType.class);
        for (BattingFact b : cappedBatting(facts, results)) {
            String key = inningsKey(b.matchId(), b.sequence());
            all.add(key);
            if (!b.hasEntry()) {
                continue;
            }
            com.cricketlegend.domain.DismissalType t = dismissal(b.howOut());
            if (t == null) {
                notRecorded++;
                continue;
            }
            if (!t.batted()) {
                continue;
            }
            recorded.add(key);
            if (notOutKind(t)) {
                notOut++;
            } else {
                types.merge(t, 1L, Long::sum);
            }
        }
        long wickets = types.values().stream().mapToLong(Long::longValue).sum();
        return new MyTeamStatsDto.MyTeamDismissals(
                notOut,
                wickets,
                typeCounts(types, notOut + wickets),
                notRecorded,
                new MyTeamStatsDto.MyTeamCount(recorded.size(), all.size()));
    }

    /**
     * Runs by batting position, positions 1 and 2 as one OPENER group, then 3 to 11; a row without a position (or outside 1
     * to 11) is left out, as are positions with no innings. A dismissal is any counted row that is not a not-out kind.
     */
    public static List<MyTeamStatsDto.MyTeamPositionGroup> battingPositionGroups(HubFacts facts, List<ResultFact> results) {
        long[][] acc = new long[TAIL_LAST + 1][4]; // innings, runs, notOuts, dismissals (index 0 = opener group)
        long total = 0;
        for (BattingFact b : cappedBatting(facts, results)) {
            com.cricketlegend.domain.DismissalType t = countedType(b);
            if (t == null || b.position() == null || b.position() < 1 || b.position() > TAIL_LAST) {
                continue;
            }
            int slot = b.position() <= OPENERS_LAST ? 0 : b.position();
            long runs = b.runs() == null ? 0L : b.runs();
            acc[slot][0]++;
            acc[slot][1] += runs;
            acc[slot][notOutKind(t) ? 2 : 3]++;
            total += runs;
        }
        List<MyTeamStatsDto.MyTeamPositionGroup> groups = new ArrayList<>();
        for (int slot = 0; slot <= TAIL_LAST; slot++) {
            if (slot == 1 || slot == 2 || acc[slot][0] == 0) {
                continue;
            }
            groups.add(new MyTeamStatsDto.MyTeamPositionGroup(
                    slot == 0 ? "OPENER" : String.valueOf(slot),
                    slot == 0 ? "Opener" : String.valueOf(slot),
                    acc[slot][0],
                    acc[slot][1],
                    ratio(acc[slot][1] * 100, total, 1),
                    acc[slot][2],
                    acc[slot][3],
                    ratio(acc[slot][1], acc[slot][3], 2)));
        }
        return groups;
    }

    /** Fours and sixes of the innings in which every counted batting row recorded both; see {@link MyTeamStatsDto.MyTeamBoundaries}. */
    public static MyTeamStatsDto.MyTeamBoundaries boundaries(HubFacts facts, List<ResultFact> results) {
        // per innings: rows, rows with both, rows with valid balls too, fours, sixes, balls, innings runs
        Map<String, long[]> innings = new LinkedHashMap<>();
        for (BattingFact b : cappedBatting(facts, results)) {
            long[] c = innings.computeIfAbsent(inningsKey(b.matchId(), b.sequence()), k -> new long[7]);
            c[6] = b.inningsRuns() == null ? 0L : b.inningsRuns();
            if (countedType(b) == null) {
                continue;
            }
            c[0]++;
            if (b.fours() != null && b.sixes() != null) {
                c[1]++;
                c[3] += b.fours();
                c[4] += b.sixes();
                if (b.balls() != null) {
                    c[2]++;
                    c[5] += b.balls();
                }
            }
        }
        long recorded = 0;
        long fours = 0;
        long sixes = 0;
        long teamRuns = 0;
        long balls = 0;
        long ballBoundaries = 0;
        for (long[] c : innings.values()) {
            if (c[0] == 0 || c[1] != c[0]) {
                continue;
            }
            recorded++;
            fours += c[3];
            sixes += c[4];
            teamRuns += c[6];
            if (c[2] == c[0]) {
                balls += c[5];
                ballBoundaries += c[3] + c[4];
            }
        }
        if (recorded == 0) {
            return new MyTeamStatsDto.MyTeamBoundaries(null, null, null, null, null, 0, innings.size());
        }
        long boundaryRuns = 4 * fours + 6 * sixes;
        return new MyTeamStatsDto.MyTeamBoundaries(
                fours,
                sixes,
                boundaryRuns,
                ratio(boundaryRuns * 100, teamRuns, 1),
                ratio(balls, ballBoundaries, 1),
                recorded,
                innings.size());
    }

    /** Batting first v chasing with the team's usable innings: {@code first} = results that batted first, {@code chasing} = batted second. */
    public static MyTeamStatsDto.MyTeamInningsSplit byInningsNumber(HubFacts facts, List<ResultFact> results) {
        Map<UUID, Map<Integer, Long>> inningsRuns = new HashMap<>();
        for (BattingFact b : facts.batting()) {
            inningsRuns.computeIfAbsent(b.matchId(), k -> new LinkedHashMap<>())
                    .put(b.sequence(), b.inningsRuns() == null ? 0L : b.inningsRuns());
        }
        long[] first = new long[4]; // played, won, innings, runs
        long[] chase = new long[4];
        for (ResultFact r : played(results)) {
            if (r.firstBattingSide() == null) {
                continue;
            }
            long[] into = r.firstBattingSide().equals(r.side()) ? first : chase;
            into[0]++;
            into[1] += r.line().result() == FormResult.WON ? 1 : 0;
            Map<Integer, Long> own = inningsRuns.getOrDefault(r.matchId(), Map.of());
            into[2] += own.size();
            into[3] += own.values().stream().mapToLong(Long::longValue).sum();
        }
        return new MyTeamStatsDto.MyTeamInningsSplit(inningsSide(first), inningsSide(chase));
    }

    private static MyTeamStatsDto.MyTeamInningsSide inningsSide(long[] c) {
        return new MyTeamStatsDto.MyTeamInningsSide(
                c[0], c[1], c[2], c[2] == 0 ? null : c[3], ratio(c[3], c[2], 2));
    }

    private static String venueKey(UUID areaId) {
        return areaId == null ? "unknown" : areaId.toString();
    }

    private static Long plus(Long a, Long b) {
        if (a == null) {
            return b;
        }
        return b == null ? a : Long.valueOf(a + b);
    }

    /** The team at each playing area: most matches first then name, twelve at most and the rest as "Other venues". */
    public static List<MyTeamStatsDto.MyTeamVenue> venues(HubFacts facts, List<ResultFact> results) {
        Map<UUID, ResultFact> byMatch = new HashMap<>();
        played(results).forEach(r -> byMatch.putIfAbsent(r.matchId(), r));
        Map<String, MyTeamStatsDto.MyTeamVenue> acc = new LinkedHashMap<>();
        for (VenueFact v : facts.venues()) {
            ResultFact r = byMatch.get(v.matchId());
            if (r == null) {
                continue;
            }
            FormResult result = r.line().result();
            String key = venueKey(v.areaId());
            MyTeamStatsDto.MyTeamVenue was = acc.get(key);
            String name = v.areaName() == null || v.areaName().isBlank() ? UNKNOWN_VENUE : v.areaName();
            acc.put(key, new MyTeamStatsDto.MyTeamVenue(
                    key,
                    name,
                    v.areaId() == null ? null : v.clubField(),
                    (was == null ? 0 : was.matches()) + 1,
                    (was == null ? 0 : was.won()) + (result == FormResult.WON ? 1 : 0),
                    (was == null ? 0 : was.lost()) + (result == FormResult.LOST ? 1 : 0),
                    (was == null ? 0 : was.tied()) + (result == FormResult.TIED ? 1 : 0),
                    plus(was == null ? null : was.runsScored(), v.ownRuns()),
                    plus(was == null ? null : was.runsConceded(), v.oppRuns()),
                    plus(was == null ? null : was.wicketsTaken(), v.oppWickets()),
                    plus(was == null ? null : was.wicketsLost(), v.ownWickets())));
        }
        List<MyTeamStatsDto.MyTeamVenue> all = new ArrayList<>(acc.values());
        all.sort(Comparator.comparingLong(MyTeamStatsDto.MyTeamVenue::matches)
                .reversed()
                .thenComparing(MyTeamStatsDto.MyTeamVenue::name, String.CASE_INSENSITIVE_ORDER));
        if (all.size() <= VENUE_CAP) {
            return all;
        }
        List<MyTeamStatsDto.MyTeamVenue> capped = new ArrayList<>(all.subList(0, VENUE_CAP));
        MyTeamStatsDto.MyTeamVenue rest = new MyTeamStatsDto.MyTeamVenue(
                "other", OTHER_VENUES, null, 0, 0, 0, 0, null, null, null, null);
        for (MyTeamStatsDto.MyTeamVenue v : all.subList(VENUE_CAP, all.size())) {
            rest = new MyTeamStatsDto.MyTeamVenue(
                    "other",
                    OTHER_VENUES,
                    null,
                    rest.matches() + v.matches(),
                    rest.won() + v.won(),
                    rest.lost() + v.lost(),
                    rest.tied() + v.tied(),
                    plus(rest.runsScored(), v.runsScored()),
                    plus(rest.runsConceded(), v.runsConceded()),
                    plus(rest.wicketsTaken(), v.wicketsTaken()),
                    plus(rest.wicketsLost(), v.wicketsLost()));
        }
        capped.add(rest);
        return capped;
    }

    /**
     * How the team's bowlers took wickets: {@link PlayerStatsCalculator#splitWickets} over every stored bowling row of the
     * opposition's counted usable innings (the player rule, so a row whose credited dismissals exceed its stored wickets is
     * wholly not itemised). Each percent is the share of {@code total}.
     */
    public static MyTeamStatsDto.MyTeamWicketTypes wicketTypes(HubFacts facts, List<ResultFact> results) {
        java.util.Set<UUID> in = countedMatches(results);
        java.util.Set<String> all = new java.util.HashSet<>();
        java.util.Set<String> withCard = new java.util.HashSet<>();
        List<PlayerStatsCalculator.BowlingCredit> credits = new ArrayList<>();
        for (WicketFact w : facts.wickets()) {
            if (!in.contains(w.matchId())) {
                continue;
            }
            String key = inningsKey(w.matchId(), w.sequence());
            all.add(key);
            if (w.bowlingEntryId() == null) {
                continue;
            }
            withCard.add(key);
            credits.add(new PlayerStatsCalculator.BowlingCredit(
                    w.bowlingEntryId(), w.wickets() == null ? 0 : w.wickets(), dismissal(w.howOut()), w.credited()));
        }
        PlayerStatsCalculator.WicketSplit split = PlayerStatsCalculator.splitWickets(credits);
        return new MyTeamStatsDto.MyTeamWicketTypes(
                split.total(),
                typeCounts(split.types(), split.total()),
                split.notItemised(),
                new MyTeamStatsDto.MyTeamCount(withCard.size(), all.size()));
    }

    /** The team's fielding credits: totals, the top {@value #FIELDER_CAP} fielders (guests grouped as one) and the rest. */
    public static MyTeamStatsDto.MyTeamFielding fielding(HubFacts facts, List<ResultFact> results) {
        java.util.Set<UUID> in = countedMatches(results);
        java.util.Set<UUID> withRecord = new java.util.HashSet<>();
        Map<UUID, long[]> byProfile = new LinkedHashMap<>();
        Map<UUID, String> names = new HashMap<>();
        long[] guests = new long[3];
        boolean anyGuests = false;
        long catches = 0;
        long stumpings = 0;
        long runOuts = 0;
        for (FieldingFact f : facts.fielding()) {
            if (!in.contains(f.matchId())) {
                continue;
            }
            if (f.entries() > 0) {
                withRecord.add(f.matchId());
            }
            catches += f.catches();
            stumpings += f.stumpings();
            runOuts += f.runOuts();
            if (f.entries() == 0) {
                continue;
            }
            long[] into;
            if (f.profileId() == null) {
                into = guests;
                anyGuests = true;
            } else {
                into = byProfile.computeIfAbsent(f.profileId(), k -> new long[3]);
                names.putIfAbsent(f.profileId(), f.name() == null || f.name().isBlank() ? UNNAMED_PLAYER : f.name());
            }
            into[0] += f.catches();
            into[1] += f.stumpings();
            into[2] += f.runOuts();
        }
        List<MyTeamStatsDto.MyTeamFielder> fielders = new ArrayList<>();
        byProfile.forEach((id, c) -> fielders.add(fielder(names.get(id), c)));
        if (anyGuests) {
            fielders.add(fielder("Guests", guests));
        }
        fielders.removeIf(f -> f.total() <= 0);
        fielders.sort(Comparator.comparingLong(MyTeamStatsDto.MyTeamFielder::total)
                .reversed()
                .thenComparing(f -> f.name().toLowerCase(Locale.ROOT)));
        long others = fielders.size() <= FIELDER_CAP
                ? 0
                : fielders.subList(FIELDER_CAP, fielders.size()).stream()
                        .mapToLong(MyTeamStatsDto.MyTeamFielder::total)
                        .sum();
        List<MyTeamStatsDto.MyTeamFielder> top = fielders.size() <= FIELDER_CAP
                ? fielders
                : new ArrayList<>(fielders.subList(0, FIELDER_CAP));
        long dismissals = catches + stumpings + runOuts;
        return new MyTeamStatsDto.MyTeamFielding(
                catches,
                stumpings,
                runOuts,
                dismissals,
                ratio(dismissals, withRecord.size(), 2),
                top,
                others,
                new MyTeamStatsDto.MyTeamCount(withRecord.size(), in.size()));
    }

    private static MyTeamStatsDto.MyTeamFielder fielder(String name, long[] c) {
        return new MyTeamStatsDto.MyTeamFielder(name, c[0], c[1], c[2], c[0] + c[1] + c[2]);
    }

    // ---- division ----

    private static BigDecimal ratio(long numerator, long denominator, int scale) {
        return denominator <= 0
                ? null
                : BigDecimal.valueOf(numerator).divide(BigDecimal.valueOf(denominator), scale, RoundingMode.HALF_UP);
    }

    private static BigDecimal ratio(long numerator, BigDecimal denominator, int scale) {
        return denominator == null || denominator.signum() <= 0
                ? null
                : BigDecimal.valueOf(numerator).divide(denominator, scale, RoundingMode.HALF_UP);
    }
}
