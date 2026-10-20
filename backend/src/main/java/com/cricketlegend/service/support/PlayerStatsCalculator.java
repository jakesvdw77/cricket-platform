package com.cricketlegend.service.support;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.dto.PlayerStatsDto;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * docs/specs/103-player-stats.md, "Precise definitions": the one place a player statistic is defined. Pure: it turns
 * one player's additive {@link PlayerStatsCounters} (and the few {@link PlayerStatsFacts}) into every derived figure, so
 * the Player page, every leaderboard and the awards can never disagree. No Spring, no repository, no entity, no caller
 * or access information.
 *
 * <p>Rounding is {@link RoundingMode#HALF_UP} applied once, at the division that produces the figure. A figure with no
 * valid denominator is {@code null}, never 0, infinity or NaN.
 */
public final class PlayerStatsCalculator {

    private static final long BEST_WICKET_UNIT = 10_000_000_000L;
    private static final long BEST_RUNS_UNIT = 100_000L;
    private static final long BEST_RUNS_CEILING = 99_999L;

    /** The figures of one player; the service wraps them with the player id and the echoed scope. */
    public record Figures(
            PlayerStatsDto.PlayerStatsBasis basis,
            PlayerStatsDto.PlayerBatting batting,
            PlayerStatsDto.PlayerBowling bowling,
            PlayerStatsDto.PlayerFielding fielding,
            PlayerStatsDto.PlayerAwards awards,
            PlayerStatsDto.PlayerRecord record,
            PlayerStatsDto.PlayerForm form,
            List<PlayerStatsDto.PlayerNotCaptured> notCaptured) {
    }

    /**
     * The statistics the data does not support yet (decided 2026-10-18), in one list: removing an item when capture
     * lands is a one-line change here.
     */
    public static final List<PlayerStatsDto.PlayerNotCaptured> NOT_CAPTURED = List.of(
            new PlayerStatsDto.PlayerNotCaptured(
                    "BATTING_DOT_BALL_PERCENTAGE",
                    "BATTING",
                    "Dot ball percentage",
                    "The scorecard does not record dot balls faced."),
            new PlayerStatsDto.PlayerNotCaptured(
                    "PARTNERSHIPS_AND_FALL_OF_WICKETS",
                    "BATTING",
                    "Partnerships and fall of wickets",
                    "The scorecard does not record the score at each wicket."),
            new PlayerStatsDto.PlayerNotCaptured(
                    "BOUNDARIES_CONCEDED",
                    "BOWLING",
                    "Boundaries conceded",
                    "The scorecard does not record fours and sixes against each bowler."),
            new PlayerStatsDto.PlayerNotCaptured(
                    "WICKETKEEPER_DISMISSALS",
                    "FIELDING",
                    "Wicketkeeper dismissals",
                    "The scorecard does not record who kept wicket."),
            new PlayerStatsDto.PlayerNotCaptured(
                    "CATCHES_DROPPED",
                    "FIELDING",
                    "Catches dropped",
                    "The scorecard does not record dropped catches."),
            new PlayerStatsDto.PlayerNotCaptured(
                    "DIRECT_HITS",
                    "FIELDING",
                    "Direct hits and run-out assists",
                    "A run-out records one fielder only."));

    private PlayerStatsCalculator() {}

    public static Figures calculate(PlayerStatsCounters counters, PlayerStatsFacts facts) {
        return new Figures(
                new PlayerStatsDto.PlayerStatsBasis(
                        counters.matches(), counters.resultsWithBattingCard(), counters.resultsWithBowlingCard()),
                batting(counters, facts),
                bowling(counters, facts),
                fielding(counters),
                new PlayerStatsDto.PlayerAwards(
                        counters.awards().playerOfTheMatch(), counters.awards().teamPlayerOfTheMatch()),
                new PlayerStatsDto.PlayerRecord(
                        counters.record().won(),
                        counters.record().lost(),
                        counters.record().tied(),
                        counters.record().drawn(),
                        counters.record().internal()),
                form(facts),
                NOT_CAPTURED);
    }

    // ---- batting ----

    static PlayerStatsDto.PlayerBatting batting(PlayerStatsCounters counters, PlayerStatsFacts facts) {
        PlayerStatsCounters.Batting b = counters.batting();
        PlayerStatsDto.PlayerHighestScore highest = b.highestScoreKey() == null
                ? null
                : new PlayerStatsDto.PlayerHighestScore(b.highestScoreKey() / 2, b.highestScoreKey() % 2 == 1);
        List<PlayerStatsDto.PlayerBattingPosition> positions = new ArrayList<>();
        for (PlayerStatsFacts.PositionFact p : facts.positions()) {
            positions.add(new PlayerStatsDto.PlayerBattingPosition(
                    p.position(), p.innings(), p.runs(), p.dismissals(), divide(p.runs(), p.dismissals(), 2)));
        }
        return new PlayerStatsDto.PlayerBatting(
                counters.matches(),
                b.innings(),
                b.notOuts(),
                b.dismissals(),
                b.runs(),
                b.ballsFaced(),
                b.fours(),
                b.sixes(),
                b.ducks(),
                b.goldenDucks(),
                b.thirtyPlus(),
                b.fiftyPlus(),
                b.hundredPlus(),
                b.centuries(),
                b.halfCenturies(),
                highest,
                modes(facts.batterDismissals(), false),
                positions,
                divide(b.runs(), b.dismissals(), 2),
                divide(b.runsWithBalls() * 100, b.ballsFaced(), 2),
                divide(b.boundaryRuns() * 100, b.runsWithBoundaries(), 1),
                divide(b.ballsForBoundaries(), b.boundaryCount(), 1),
                new PlayerStatsDto.PlayerBattingCoverage(b.inningsWithBalls(), b.inningsWithBoundaries(), b.innings()));
    }

    // ---- bowling ----

    static PlayerStatsDto.PlayerBowling bowling(PlayerStatsCounters counters, PlayerStatsFacts facts) {
        PlayerStatsCounters.Bowling w = counters.bowling();
        PlayerStatsDto.PlayerBestBowling best = null;
        if (w.bestBowlingKey() != null) {
            long key = w.bestBowlingKey();
            long remainder = key % BEST_WICKET_UNIT;
            best = new PlayerStatsDto.PlayerBestBowling(
                    key / BEST_WICKET_UNIT, BEST_RUNS_CEILING - remainder / BEST_RUNS_UNIT);
        }
        Map<String, Long> modes = modes(facts.bowlerDismissals(), true);
        long recorded = modes.values().stream().mapToLong(Long::longValue).sum();
        BigDecimal economy = null;
        if (w.balls() > 0 && w.overs() != null && w.overs().signum() > 0) {
            economy = BigDecimal.valueOf(w.runs()).divide(w.overs(), 2, RoundingMode.HALF_UP);
        }
        return new PlayerStatsDto.PlayerBowling(
                w.inningsBowled(),
                w.balls(),
                w.ballsPerOver(),
                w.ballsPerOver().size() > 1,
                w.runs(),
                w.wickets(),
                w.maidens(),
                w.wides(),
                w.noBalls(),
                w.dots(),
                w.threeWicketHauls(),
                w.fourWicketHauls(),
                w.fiveWicketHauls(),
                best,
                modes,
                Math.max(0, w.wickets() - recorded),
                divide(w.runs(), w.wickets(), 2),
                economy,
                divide(w.balls(), w.wickets(), 1),
                divide(w.dots() * 100, w.ballsWithDots(), 1),
                new PlayerStatsDto.PlayerBowlingCoverage(
                        w.inningsWithWides(), w.inningsWithNoBalls(), w.inningsWithDots(), w.inningsBowled()));
    }

    // ---- fielding and form ----

    static PlayerStatsDto.PlayerFielding fielding(PlayerStatsCounters counters) {
        PlayerStatsCounters.Fielding f = counters.fielding();
        long dismissals = f.catches() + f.stumpings() + f.runOuts();
        return new PlayerStatsDto.PlayerFielding(
                f.catches(), f.stumpings(), f.runOuts(), dismissals, divide(dismissals, counters.matches(), 2));
    }

    static PlayerStatsDto.PlayerForm form(PlayerStatsFacts facts) {
        List<PlayerStatsDto.PlayerBattingInnings> batting = new ArrayList<>();
        for (PlayerStatsFacts.InningsFact i : facts.recentInnings()) {
            batting.add(new PlayerStatsDto.PlayerBattingInnings(i.matchId(), i.matchDate(), i.runs(), i.notOut(), i.balls()));
        }
        List<PlayerStatsDto.PlayerBowlingSpell> bowling = new ArrayList<>();
        for (PlayerStatsFacts.SpellFact s : facts.recentSpells()) {
            bowling.add(new PlayerStatsDto.PlayerBowlingSpell(
                    s.matchId(), s.matchDate(), s.wickets(), s.runs(), s.balls(), s.ballsPerOver()));
        }
        return new PlayerStatsDto.PlayerForm(batting, bowling);
    }

    // ---- helpers ----

    /** The best-bowling key the aggregate query encodes, for tests and the ranker (wickets, then fewer runs, then more balls). */
    public static long bestBowlingKey(long wickets, long runs, long balls) {
        return wickets * BEST_WICKET_UNIT + (BEST_RUNS_CEILING - Math.min(runs, BEST_RUNS_CEILING)) * BEST_RUNS_UNIT
                + Math.min(balls, BEST_RUNS_CEILING);
    }

    /** The highest-score key the aggregate query encodes: a not-out innings beats the same score out. */
    public static long highestScoreKey(long runs, boolean notOut) {
        return runs * 2 + (notOut ? 1 : 0);
    }

    /** Non-zero counts by dismissal type in enum order; with {@code bowlerCreditedOnly} only those a bowler is credited with. */
    private static Map<String, Long> modes(Map<DismissalType, Long> counts, boolean bowlerCreditedOnly) {
        Map<DismissalType, Long> ordered = new EnumMap<>(DismissalType.class);
        ordered.putAll(counts);
        Map<String, Long> result = new LinkedHashMap<>();
        ordered.forEach((type, count) -> {
            if (count != null && count > 0 && (!bowlerCreditedOnly || type.isBowlerCredited())) {
                result.put(type.name(), count);
            }
        });
        return result;
    }

    /** {@code numerator / denominator} to {@code scale} places, HALF_UP, null when the denominator is not positive. */
    private static BigDecimal divide(long numerator, long denominator, int scale) {
        if (denominator <= 0) {
            return null;
        }
        return BigDecimal.valueOf(numerator).divide(BigDecimal.valueOf(denominator), scale, RoundingMode.HALF_UP);
    }
}
