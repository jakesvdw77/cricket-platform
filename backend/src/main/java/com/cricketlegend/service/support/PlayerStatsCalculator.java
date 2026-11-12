package com.cricketlegend.service.support;

import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.dto.MyStatsDto;
import com.cricketlegend.dto.PlayerMatchRowDto;
import com.cricketlegend.dto.PlayerStatsDto;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

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
        BigDecimal economy = w.balls() > 0 ? economy(w.runs(), w.overs()) : null;
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

    // ---- docs/specs/117-stats-dashboard.md: the single-match and split definitions the Dashboard series call ----

    /** Scale of an over count derived from balls and a match's balls per over (spec 103: ten or more decimal places). */
    private static final int OVERS_SCALE = 20;

    /**
     * Economy Rate (spec 103): runs per over to 2 decimals, HALF_UP once; null when there are no overs. The Bowling tab's Econ
     * figure and every Dashboard economy value come from this one method.
     */
    public static BigDecimal economy(long runs, BigDecimal overs) {
        if (overs == null || overs.signum() <= 0) {
            return null;
        }
        return BigDecimal.valueOf(runs).divide(overs, 2, RoundingMode.HALF_UP);
    }

    /** One match's overs: {@code balls} divided by that match's balls per over (null when either is not positive). */
    public static BigDecimal matchOvers(long balls, int ballsPerOver) {
        if (balls <= 0 || ballsPerOver <= 0) {
            return null;
        }
        return BigDecimal.valueOf(balls).divide(BigDecimal.valueOf(ballsPerOver), OVERS_SCALE, RoundingMode.HALF_UP);
    }

    /** One match's economy: runs per over of that match's balls (spec 117), null at zero balls. */
    public static BigDecimal matchEconomy(long runs, long balls, int ballsPerOver) {
        return economy(runs, matchOvers(balls, ballsPerOver));
    }

    /** One match's weight in the economy trend (spec 117): its runs over its overs, pooled by the trend hint. */
    public static StatsTrend.Weighted economyWeight(long runs, long balls, int ballsPerOver) {
        return new StatsTrend.Weighted(BigDecimal.valueOf(runs), matchOvers(balls, ballsPerOver));
    }

    /** Batting Average (spec 103): runs per dismissal, 2 decimals, null with no dismissal. */
    public static BigDecimal battingAverage(long runs, long dismissals) {
        return divide(runs, dismissals, 2);
    }

    /** A share as a percentage to 1 decimal, HALF_UP once; null when the total is not positive. */
    public static BigDecimal percent(long part, long total) {
        return divide(part * 100, total, 1);
    }

    /**
     * Counts of a player's own batting innings by how they ended, for "How you were dismissed": both not-out kinds are one
     * {@code NOT_OUT} entry (first), then the other types in enum order; {@code DID_NOT_BAT} is not an innings. Only types
     * with a count are returned.
     */
    public static Map<DismissalType, Long> dismissalCounts(Collection<DismissalType> howOuts) {
        Map<DismissalType, Long> counts = new EnumMap<>(DismissalType.class);
        for (DismissalType howOut : howOuts) {
            if (howOut == null || !howOut.batted()) {
                continue;
            }
            DismissalType key = howOut == DismissalType.RETIRED_NOT_OUT ? DismissalType.NOT_OUT : howOut;
            counts.merge(key, 1L, Long::sum);
        }
        return counts;
    }

    /**
     * One stored bowling row and the batting entries of its innings that name the bowler: {@code howOut} is how those
     * batters were out and {@code credited} how many (a row with no such entry has a null {@code howOut} and 0). Several
     * rows share a {@code bowlingEntryId} when different dismissal types were credited.
     */
    public record BowlingCredit(UUID bowlingEntryId, int wickets, DismissalType howOut, long credited) {
    }

    /**
     * The wickets split by type (spec 117, "Wickets by type"): per bowling row, {@code c} = the batting entries naming the
     * bowler with a bowler-credited type; {@code w} = the stored wickets. When {@code c <= w} each type gets its count and
     * {@code w - c} is not itemised; when {@code c > w} the stored wickets are authoritative and all {@code w} are not
     * itemised. So {@code Σ types + notItemised = total = Σ w} always. Run-outs and the other non-bowler wickets are never
     * credited to a bowler. {@code inningsItemised} counts rows with wickets whose split was used with {@code c > 0}.
     */
    public record WicketSplit(
            Map<DismissalType, Long> types,
            long notItemised,
            long total,
            long itemised,
            long inningsItemised,
            long inningsWithWickets) {
    }

    public static WicketSplit splitWickets(Collection<BowlingCredit> credits) {
        Map<UUID, List<BowlingCredit>> byRow = new LinkedHashMap<>();
        for (BowlingCredit credit : credits) {
            byRow.computeIfAbsent(credit.bowlingEntryId(), id -> new ArrayList<>()).add(credit);
        }
        Map<DismissalType, Long> types = new EnumMap<>(DismissalType.class);
        long notItemised = 0;
        long total = 0;
        long itemised = 0;
        long inningsItemised = 0;
        long inningsWithWickets = 0;
        for (List<BowlingCredit> row : byRow.values()) {
            long wickets = row.get(0).wickets();
            if (wickets <= 0) {
                continue;
            }
            total += wickets;
            inningsWithWickets++;
            Map<DismissalType, Long> credited = new HashMap<>();
            long creditedTotal = 0;
            for (BowlingCredit credit : row) {
                if (credit.howOut() != null && credit.howOut().isBowlerCredited() && credit.credited() > 0) {
                    credited.merge(credit.howOut(), credit.credited(), Long::sum);
                    creditedTotal += credit.credited();
                }
            }
            if (creditedTotal > 0 && creditedTotal <= wickets) {
                credited.forEach((type, count) -> types.merge(type, count, Long::sum));
                itemised += creditedTotal;
                notItemised += wickets - creditedTotal;
                inningsItemised++;
            } else {
                notItemised += wickets;
            }
        }
        return new WicketSplit(types, notItemised, total, itemised, inningsItemised, inningsWithWickets);
    }

    // ---- docs/specs/147-player-hub-stats.md: the Player Hub "My stats" figures, defined here and nowhere else ----

    /** The platform's fixed "30+" definition (spec 103): also the "scored 30 or more" of the team-record card and drill. */
    public static final int THIRTY_PLUS = 30;

    /** The score bands (spec 147): 0-9, 10-29, 30-49, 50+. The edges are fixed definitions, not the age-band guides. */
    public static final int BAND_TEN = 10;
    public static final int BAND_THIRTY = 30;
    public static final int BAND_FIFTY = 50;

    /** Graph guide lines per age band (spec 147, Open question 8: proposals, one line each to correct). */
    public static final int ADULT_GUIDE_LOW = 30;
    public static final int ADULT_GUIDE_HIGH = 50;
    public static final int UNDER_13_GUIDE_LOW = 15;
    public static final int UNDER_13_GUIDE_HIGH = 30;
    public static final int AGE_13_17_GUIDE_LOW = 20;
    public static final int AGE_13_17_GUIDE_HIGH = 40;

    /** Ages (years) at which the age band changes. */
    public static final int YOUNGEST_TEEN_AGE = 13;
    public static final int ADULT_AGE = 18;

    /** The rolling average and its hint use the last this-many batted innings (the same span as every trend hint). */
    public static final int ROLLING_SPAN = DashboardLimits.TREND_SPAN;

    /** "Best strike rate" only considers innings of at least this many valid balls. */
    public static final int MINIMUM_BALLS_FOR_BEST_STRIKE_RATE = 20;

    /** Next-milestone ladders: the first rung above the current figure, then multiples of the step. */
    private static final long[] RUNS_LADDER = {50, 100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000};
    private static final long RUNS_STEP = 1000;
    private static final long[] WICKETS_LADDER = {5, 10, 25, 50, 75, 100, 150, 200, 250, 300};
    private static final long WICKETS_STEP = 100;
    private static final long[] CATCHES_LADDER = {5, 10, 25, 50, 75, 100, 150, 200};
    private static final long CATCHES_STEP = 50;

    /** The batting positions of the "wickets by position" groups: openers 1-2, middle 3-6, tail 7-11. */
    private static final int OPENERS_LAST = 2;
    private static final int MIDDLE_LAST = 6;
    private static final int TAIL_LAST = 11;

    /** How old the player was when the latest counted match in scope was played. */
    public enum AgeBand {
        ADULT,
        UNDER_13,
        AGE_13_17,
        UNKNOWN
    }

    /** One counted batting row from the Hub detail read, as the repository returns it. */
    public record RawBattingDetail(
            UUID resultId,
            int inningsSequence,
            Integer position,
            Integer runs,
            Integer balls,
            Integer fours,
            Integer sixes,
            DismissalType howOut,
            String bowlerName,
            UUID seasonId,
            boolean fieldKnown,
            boolean clubField,
            UUID areaId,
            String areaName) {
    }

    /** A counted batting row joined to its match (opponent, date); {@code balls} is null when not valid (spec 103). */
    public record InningsDetail(
            UUID resultId,
            UUID matchId,
            Instant matchDate,
            String opponentName,
            boolean derby,
            UUID seasonId,
            int inningsSequence,
            Integer position,
            Integer runs,
            Integer balls,
            Integer fours,
            Integer sixes,
            DismissalType howOut,
            boolean notOut,
            String bowlerName,
            boolean fieldKnown,
            boolean clubField,
            UUID areaId,
            String areaName) {
    }

    /** The playing area of a counted match (null ids when none is recorded) and whether it is one of the club's home fields. */
    public record ResultVenue(UUID resultId, UUID areaId, String areaName, boolean clubField) {
    }

    /**
     * A batter the player dismissed. {@code fielderName} is the player's own fielder (null for an opposition fielder or none
     * named).
     */
    public record WicketDetail(UUID resultId, Integer position, DismissalType howOut, String fielderName) {
    }

    /** One season's additive counters, with the season's label and start for ordering. */
    public record SeasonCounters(
            UUID seasonId,
            String label,
            LocalDate startDate,
            long matches,
            long innings,
            long dismissals,
            long runs,
            long wickets) {
    }

    /** A closed poll the player was asked; {@code status} is null when unanswered. */
    public record PollFact(UUID matchId, UUID seasonId, UUID leagueId, UUID teamId, AvailabilityStatus status) {
    }

    /** A started match the player was selected for. */
    public record SelectionFact(UUID matchId, UUID seasonId, UUID leagueId, UUID teamId) {
    }

    /** One innings' strike rate (runs per 100 balls, 2 decimals); null when the runs or the valid balls are not recorded. */
    public static BigDecimal strikeRate(Integer runs, Integer balls) {
        if (runs == null || balls == null) {
            return null;
        }
        return divide(runs * 100L, balls, 2);
    }

    /** The age band on the date of the latest counted match (today when there is none); UNKNOWN without a date of birth. */
    public static AgeBand ageBand(LocalDate dateOfBirth, Instant latestCountedMatch) {
        if (dateOfBirth == null) {
            return AgeBand.UNKNOWN;
        }
        LocalDate on = latestCountedMatch == null
                ? LocalDate.now(ZoneOffset.UTC)
                : latestCountedMatch.atZone(ZoneOffset.UTC).toLocalDate();
        if (on.isBefore(dateOfBirth)) {
            return AgeBand.UNKNOWN;
        }
        int age = Period.between(dateOfBirth, on).getYears();
        if (age < YOUNGEST_TEEN_AGE) {
            return AgeBand.UNDER_13;
        }
        return age < ADULT_AGE ? AgeBand.AGE_13_17 : AgeBand.ADULT;
    }

    /** The two graph guide lines for the age band. Reference lines only: they never change a counted figure. */
    public static MyStatsDto.MyStatsGuides guides(AgeBand band) {
        return switch (band) {
            case UNDER_13 -> new MyStatsDto.MyStatsGuides(UNDER_13_GUIDE_LOW, UNDER_13_GUIDE_HIGH, band.name());
            case AGE_13_17 -> new MyStatsDto.MyStatsGuides(AGE_13_17_GUIDE_LOW, AGE_13_17_GUIDE_HIGH, band.name());
            case ADULT, UNKNOWN -> new MyStatsDto.MyStatsGuides(ADULT_GUIDE_LOW, ADULT_GUIDE_HIGH, band.name());
        };
    }

    /** Joins the detail rows to their matches, in the rows' order (oldest first) and then innings sequence. */
    public static List<InningsDetail> joinInnings(List<PlayerMatchRowDto> rowsOldestFirst, Collection<RawBattingDetail> raw) {
        Map<UUID, List<RawBattingDetail>> byResult = new HashMap<>();
        for (RawBattingDetail detail : raw) {
            byResult.computeIfAbsent(detail.resultId(), id -> new ArrayList<>()).add(detail);
        }
        List<InningsDetail> joined = new ArrayList<>(raw.size());
        for (PlayerMatchRowDto row : rowsOldestFirst) {
            for (RawBattingDetail d : byResult.getOrDefault(row.resultId(), List.of())) {
                joined.add(new InningsDetail(
                        d.resultId(),
                        row.matchId(),
                        row.matchDate(),
                        row.opponentName(),
                        row.derby(),
                        d.seasonId(),
                        d.inningsSequence(),
                        d.position(),
                        d.runs(),
                        d.balls(),
                        d.fours(),
                        d.sixes(),
                        d.howOut(),
                        d.howOut() != null && !d.howOut().isWicket() && d.howOut().batted(),
                        d.bowlerName(),
                        d.fieldKnown(),
                        d.clubField(),
                        d.areaId(),
                        d.areaName()));
            }
        }
        return joined;
    }

    // ---- rolling average and its hint ----

    /**
     * The average of the last {@link #ROLLING_SPAN} batted innings after each innings (runs per dismissal within that
     * window, null while the window holds no dismissal): the last {@link DashboardLimits#POINT_LIMIT} points of the history,
     * oldest first. The hint pools the last span against the span before (null when either half is too small).
     */
    public static MyStatsDto.MyStatsRolling rolling(List<InningsDetail> inningsOldestFirst) {
        List<MyStatsDto.MyStatsRollingPoint> points = new ArrayList<>(inningsOldestFirst.size());
        for (int i = 0; i < inningsOldestFirst.size(); i++) {
            int from = Math.max(0, i + 1 - ROLLING_SPAN);
            long runs = 0;
            long dismissals = 0;
            for (InningsDetail d : inningsOldestFirst.subList(from, i + 1)) {
                runs += d.runs() == null ? 0L : d.runs();
                if (!d.notOut()) {
                    dismissals++;
                }
            }
            InningsDetail at = inningsOldestFirst.get(i);
            points.add(new MyStatsDto.MyStatsRollingPoint(at.matchId(), at.matchDate(), battingAverage(runs, dismissals)));
        }
        List<StatsTrend.Weighted> weighted = new ArrayList<>(inningsOldestFirst.size());
        for (InningsDetail d : inningsOldestFirst) {
            weighted.add(new StatsTrend.Weighted(
                    BigDecimal.valueOf(d.runs() == null ? 0L : d.runs()), d.notOut() ? BigDecimal.ZERO : BigDecimal.ONE));
        }
        StatsTrend.Hint hint = StatsTrend.of(weighted, 2, DashboardLimits.BATTING_AVERAGE_FLAT_BAND);
        int from = Math.max(0, points.size() - DashboardLimits.POINT_LIMIT);
        return new MyStatsDto.MyStatsRolling(
                ROLLING_SPAN,
                List.copyOf(points.subList(from, points.size())),
                hint == null ? null : new MyStatsDto.MyStatsTrendHint(hint.recent(), hint.earlier(), hint.direction().name()));
    }

    // ---- bands, innings number, opposition ----

    /** Scores in 0-9, 10-29, 30-49 and 50+ (innings with a stored score only), count and share, with the drill token. */
    public static List<MyStatsDto.MyStatsBand> bands(Collection<InningsDetail> innings) {
        long[] counts = new long[4];
        long total = 0;
        for (InningsDetail d : innings) {
            if (d.runs() == null) {
                continue;
            }
            total++;
            int runs = d.runs();
            counts[runs >= BAND_FIFTY ? 3 : runs >= BAND_THIRTY ? 2 : runs >= BAND_TEN ? 1 : 0]++;
        }
        String[] keys = {"0-9", "10-29", "30-49", "50+"};
        String[] filters = {"BAND_0_9", "BAND_10_29", "BAND_30_49", "BAND_50_PLUS"};
        List<MyStatsDto.MyStatsBand> bands = new ArrayList<>(4);
        for (int i = 0; i < 4; i++) {
            bands.add(new MyStatsDto.MyStatsBand(keys[i], keys[i], counts[i], percent(counts[i], total), filters[i]));
        }
        return bands;
    }

    /** Batting first (the first innings of the match) and chasing (the second): innings, not outs, runs and average. */
    public static MyStatsDto.MyStatsByInningsNumber byInningsNumber(Collection<InningsDetail> innings) {
        return new MyStatsDto.MyStatsByInningsNumber(
                inningsSplit(innings, 1, "FIRST_INNINGS"), inningsSplit(innings, 2, "SECOND_INNINGS"));
    }

    private static MyStatsDto.MyStatsInningsSplit inningsSplit(Collection<InningsDetail> innings, int sequence, String filter) {
        long count = 0;
        long notOuts = 0;
        long runs = 0;
        long dismissals = 0;
        for (InningsDetail d : innings) {
            if (d.inningsSequence() != sequence) {
                continue;
            }
            count++;
            runs += d.runs() == null ? 0L : d.runs();
            if (d.notOut()) {
                notOuts++;
            } else {
                dismissals++;
            }
        }
        return new MyStatsDto.MyStatsInningsSplit(count, notOuts, runs, battingAverage(runs, dismissals), filter);
    }

    /**
     * The player's scores against each opponent name as recorded (grouped ignoring case and surrounding spaces; a derby has
     * no opponent and is left out), scores in date order, the most-played opponent first, then by name.
     */
    public static List<MyStatsDto.MyStatsOpposition> byOpposition(List<InningsDetail> inningsOldestFirst) {
        Map<String, List<InningsDetail>> byName = new LinkedHashMap<>();
        for (InningsDetail d : inningsOldestFirst) {
            if (d.derby() || d.opponentName() == null || d.opponentName().isBlank()) {
                continue;
            }
            byName.computeIfAbsent(d.opponentName().trim().toLowerCase(java.util.Locale.ROOT), k -> new ArrayList<>()).add(d);
        }
        List<MyStatsDto.MyStatsOpposition> result = new ArrayList<>();
        for (List<InningsDetail> list : byName.values()) {
            long runs = 0;
            long dismissals = 0;
            List<MyStatsDto.MyStatsScore> scores = new ArrayList<>(list.size());
            for (InningsDetail d : list) {
                runs += d.runs() == null ? 0L : d.runs();
                if (!d.notOut()) {
                    dismissals++;
                }
                scores.add(new MyStatsDto.MyStatsScore(d.matchId(), d.matchDate(), d.runs(), d.notOut()));
            }
            result.add(new MyStatsDto.MyStatsOpposition(
                    list.get(list.size() - 1).opponentName().trim(), list.size(), runs, battingAverage(runs, dismissals), scores));
        }
        result.sort(Comparator.comparingLong(MyStatsDto.MyStatsOpposition::innings).reversed()
                .thenComparing(MyStatsDto.MyStatsOpposition::opponentName, String.CASE_INSENSITIVE_ORDER));
        return result;
    }

    // ---- who got the player out, and whom the player dismissed ----

    /**
     * The bowlers who dismissed the player: a bowler-credited out names a bowler as recorded, or counts in {@code
     * notRecorded}. Most dismissals first, then by name.
     */
    public static MyStatsDto.MyStatsDismissedBy dismissedBy(Collection<InningsDetail> innings) {
        Map<String, Long> byBowler = new LinkedHashMap<>();
        long notRecorded = 0;
        long total = 0;
        for (InningsDetail d : innings) {
            if (d.howOut() == null || !d.howOut().isBowlerCredited()) {
                continue;
            }
            total++;
            if (d.bowlerName() == null || d.bowlerName().isBlank()) {
                notRecorded++;
            } else {
                byBowler.merge(d.bowlerName().trim(), 1L, Long::sum);
            }
        }
        return new MyStatsDto.MyStatsDismissedBy(nameCounts(byBowler), notRecorded, total);
    }

    /**
     * The batters the player dismissed (bowler-credited types) by batting position, and the player's own fielders on caught
     * dismissals. A dismissal with no position, or a position outside 1 to 11, is not recorded.
     */
    public static MyStatsDto.MyStatsWicketsByPosition wicketsByPosition(Collection<WicketDetail> wickets) {
        long openers = 0;
        long middle = 0;
        long tail = 0;
        long notRecorded = 0;
        long total = 0;
        Map<String, Long> caughtBy = new LinkedHashMap<>();
        for (WicketDetail w : wickets) {
            if (w.howOut() == null || !w.howOut().isBowlerCredited()) {
                continue;
            }
            total++;
            Integer position = w.position();
            if (position == null || position < 1 || position > TAIL_LAST) {
                notRecorded++;
            } else if (position <= OPENERS_LAST) {
                openers++;
            } else if (position <= MIDDLE_LAST) {
                middle++;
            } else {
                tail++;
            }
            if (w.howOut() == DismissalType.CAUGHT && w.fielderName() != null && !w.fielderName().isBlank()) {
                caughtBy.merge(w.fielderName().trim(), 1L, Long::sum);
            }
        }
        return new MyStatsDto.MyStatsWicketsByPosition(
                List.of(
                        new MyStatsDto.MyStatsPositionGroup("OPENERS", "Openers", openers),
                        new MyStatsDto.MyStatsPositionGroup("MIDDLE", "Middle order", middle),
                        new MyStatsDto.MyStatsPositionGroup("TAIL", "Tail", tail)),
                notRecorded,
                total,
                nameCounts(caughtBy));
    }

    private static List<MyStatsDto.MyStatsNameCount> nameCounts(Map<String, Long> counts) {
        List<MyStatsDto.MyStatsNameCount> list = new ArrayList<>(counts.size());
        counts.forEach((name, count) -> list.add(new MyStatsDto.MyStatsNameCount(name, count)));
        list.sort(Comparator.comparingLong(MyStatsDto.MyStatsNameCount::count).reversed()
                .thenComparing(MyStatsDto.MyStatsNameCount::name, String.CASE_INSENSITIVE_ORDER));
        return list;
    }

    // ---- milestones and personal bests ----

    /**
     * The next round numbers for runs, wickets and catches in the whole scope (from the counters), and the personal bests
     * of the history (rows oldest first; on a tie the most recent match wins).
     */
    public static MyStatsDto.MyStatsMilestones milestones(
            PlayerStatsCounters counters, List<PlayerMatchRowDto> rowsOldestFirst, List<InningsDetail> inningsOldestFirst) {
        return new MyStatsDto.MyStatsMilestones(
                milestone(counters.batting().runs(), RUNS_LADDER, RUNS_STEP),
                milestone(counters.bowling().wickets(), WICKETS_LADDER, WICKETS_STEP),
                milestone(counters.fielding().catches(), CATCHES_LADDER, CATCHES_STEP),
                personalBests(rowsOldestFirst, inningsOldestFirst));
    }

    /** The first ladder rung above {@code current}, else the next multiple of {@code step} above it. */
    static MyStatsDto.MyStatsMilestone milestone(long current, long[] ladder, long step) {
        for (long rung : ladder) {
            if (rung > current) {
                return new MyStatsDto.MyStatsMilestone(current, rung, rung - current);
            }
        }
        long target = (current / step + 1) * step;
        return new MyStatsDto.MyStatsMilestone(current, target, target - current);
    }

    private static MyStatsDto.MyStatsPersonalBests personalBests(
            List<PlayerMatchRowDto> rowsOldestFirst, List<InningsDetail> inningsOldestFirst) {
        MyStatsDto.MyStatsBestInnings highest = null;
        long highestKey = -1;
        MyStatsDto.MyStatsBestStrikeRate bestRate = null;
        for (InningsDetail d : inningsOldestFirst) {
            if (d.runs() == null) {
                continue;
            }
            long key = highestScoreKey(d.runs(), d.notOut());
            if (key >= highestKey) {
                highestKey = key;
                highest = new MyStatsDto.MyStatsBestInnings(d.runs(), d.notOut(), d.matchId());
            }
            if (d.balls() != null && d.balls() >= MINIMUM_BALLS_FOR_BEST_STRIKE_RATE) {
                BigDecimal rate = divide(d.runs() * 100L, d.balls(), 2);
                if (bestRate == null || rate.compareTo(bestRate.strikeRate()) >= 0) {
                    bestRate = new MyStatsDto.MyStatsBestStrikeRate(rate, d.runs(), d.balls(), d.matchId());
                }
            }
        }
        MyStatsDto.MyStatsBestBowling bestBowling = null;
        long bestBowlingKey = -1;
        MyStatsDto.MyStatsBestCatches mostCatches = null;
        for (PlayerMatchRowDto row : rowsOldestFirst) {
            if (row.bowling().spells() != null) {
                for (PlayerMatchRowDto.PlayerMatchSpell spell : row.bowling().spells()) {
                    long key = bestBowlingKey(spell.wickets(), spell.runs(), spell.balls());
                    if (key >= bestBowlingKey) {
                        bestBowlingKey = key;
                        bestBowling = new MyStatsDto.MyStatsBestBowling(spell.wickets(), spell.runs(), row.matchId());
                    }
                }
            }
            Long catches = row.fielding().catches();
            if (catches != null && catches > 0 && (mostCatches == null || catches >= mostCatches.catches())) {
                mostCatches = new MyStatsDto.MyStatsBestCatches(catches, row.matchId());
            }
        }
        return new MyStatsDto.MyStatsPersonalBests(
                highest, bestBowling, mostCatches, bestRate, MINIMUM_BALLS_FOR_BEST_STRIKE_RATE);
    }

    // ---- team record when the player scores 30 ----

    /**
     * The team's record in counted matches with a captured batting card in which the player scored 30 or more in an
     * innings, and in those where he did not (including not batting). A derby is left out; NO_RESULT and ABANDONED matches
     * count as matches but add to no won, lost, tied or drawn.
     */
    public static MyStatsDto.MyStatsTeamRecordWhenScoring teamRecordWhenScoring(
            List<PlayerMatchRowDto> rows, Collection<InningsDetail> innings) {
        Map<UUID, Integer> best = new HashMap<>();
        for (InningsDetail d : innings) {
            if (d.runs() != null) {
                best.merge(d.resultId(), d.runs(), Math::max);
            }
        }
        long[] scored = new long[5];
        long[] notScored = new long[5];
        for (PlayerMatchRowDto row : rows) {
            if (row.derby() || !row.hasBattingCard()) {
                continue;
            }
            long[] into = best.getOrDefault(row.resultId(), -1) >= THIRTY_PLUS ? scored : notScored;
            into[0]++;
            switch (row.result()) {
                case WON -> into[1]++;
                case LOST -> into[2]++;
                case TIED -> into[3]++;
                case DRAWN -> into[4]++;
                default -> { }
            }
        }
        return new MyStatsDto.MyStatsTeamRecordWhenScoring(
                THIRTY_PLUS, recordSplit(scored), recordSplit(notScored), "SCORED_30_PLUS", "UNDER_30");
    }

    private static MyStatsDto.MyStatsRecordSplit recordSplit(long[] c) {
        return new MyStatsDto.MyStatsRecordSplit(c[0], c[1], c[2], c[3], c[4], percent(c[1], c[1] + c[2] + c[3] + c[4]));
    }

    // ---- home ground versus away ----

    /**
     * Batting at the club's own home fields versus elsewhere. An innings whose match names no playing area is in neither
     * split; those matches are counted in {@code unknownFieldMatches}.
     */
    public static MyStatsDto.MyStatsHomeAway homeAway(Collection<InningsDetail> innings) {
        long[] home = new long[3]; // innings, dismissals, runs
        long[] away = new long[3];
        java.util.Set<UUID> unknown = new java.util.HashSet<>();
        for (InningsDetail d : innings) {
            if (!d.fieldKnown()) {
                unknown.add(d.resultId());
                continue;
            }
            long[] into = d.clubField() ? home : away;
            into[0]++;
            if (!d.notOut()) {
                into[1]++;
            }
            into[2] += d.runs() == null ? 0L : d.runs();
        }
        return new MyStatsDto.MyStatsHomeAway(fieldSplit(home), fieldSplit(away), unknown.size());
    }

    private static MyStatsDto.MyStatsFieldSplit fieldSplit(long[] c) {
        return new MyStatsDto.MyStatsFieldSplit(c[0], c[1], c[2], battingAverage(c[2], c[1]));
    }

    // ---- amendment 2: summary, batting position groups, venues ----

    private static final int VENUE_CAP = 12;
    private static final String UNKNOWN_VENUE = "Unknown venue";
    private static final String OTHER_VENUES = "Other venues";

    /**
     * The Summary group: leagues (friendlies excluded) and teams the player appeared for, each with its distinct counted
     * matches (from the capped history rows), and the whole-scope totals from the already-defined counters.
     */
    public static MyStatsDto.MyStatsSummary summary(
            PlayerStatsDto stats, PlayerStatsCounters counters, Collection<PlayerMatchRowDto> rows) {
        Map<UUID, String> leagueNames = new LinkedHashMap<>();
        Map<UUID, java.util.Set<UUID>> leagueMatches = new HashMap<>();
        Map<UUID, String> teamNames = new LinkedHashMap<>();
        Map<UUID, java.util.Set<UUID>> teamMatches = new HashMap<>();
        for (PlayerMatchRowDto row : rows) {
            if (row.leagueId() != null) {
                leagueNames.putIfAbsent(row.leagueId(), row.leagueName());
                leagueMatches.computeIfAbsent(row.leagueId(), k -> new java.util.HashSet<>()).add(row.matchId());
            }
            for (PlayerMatchRowDto.PlayerMatchTeam t : row.ourTeams()) {
                if (t.teamId() != null) {
                    teamNames.putIfAbsent(t.teamId(), t.teamName());
                    teamMatches.computeIfAbsent(t.teamId(), k -> new java.util.HashSet<>()).add(row.matchId());
                }
            }
        }
        List<MyStatsDto.MyStatsLeagueMatches> leagues = new ArrayList<>();
        leagueNames.forEach((id, name) ->
                leagues.add(new MyStatsDto.MyStatsLeagueMatches(id, name, leagueMatches.get(id).size())));
        leagues.sort(Comparator.comparingLong(MyStatsDto.MyStatsLeagueMatches::matches).reversed()
                .thenComparing(MyStatsDto.MyStatsLeagueMatches::name, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)));
        List<MyStatsDto.MyStatsTeamMatches> teams = new ArrayList<>();
        teamNames.forEach((id, name) ->
                teams.add(new MyStatsDto.MyStatsTeamMatches(id, name, teamMatches.get(id).size())));
        teams.sort(Comparator.comparingLong(MyStatsDto.MyStatsTeamMatches::matches).reversed()
                .thenComparing(MyStatsDto.MyStatsTeamMatches::name, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)));
        PlayerStatsDto.PlayerBowling bowling = stats.bowling();
        Integer ballsPerOver = bowling.mixedOverLengths() || bowling.ballsPerOver().isEmpty()
                ? null
                : bowling.ballsPerOver().get(0);
        return new MyStatsDto.MyStatsSummary(
                leagues,
                teams,
                stats.basis().matchesCounted(),
                stats.batting().runs(),
                counters.batting().inningsWithBalls() == 0 ? null : stats.batting().ballsFaced(),
                bowling.ballsBowled(),
                ballsPerOver,
                stats.fielding().catches());
    }

    /**
     * Batting by position with positions 1 and 2 as one OPENER group, then 3 to 11. Same per-innings position data and the
     * same dismissal rule (a not-out kind is not a dismissal) as {@code batting.positions}; positions without an innings
     * are omitted.
     */
    public static List<MyStatsDto.MyStatsBattingPositionGroup> battingPositionGroups(Collection<InningsDetail> innings) {
        long[][] acc = new long[TAIL_LAST + 1][4]; // innings, runs, notOuts, dismissals (index 0 = opener group)
        Integer[] highest = new Integer[TAIL_LAST + 1];
        for (InningsDetail d : innings) {
            if (d.position() == null || d.position() < 1 || d.position() > TAIL_LAST) {
                continue;
            }
            int slot = d.position() <= OPENERS_LAST ? 0 : d.position();
            acc[slot][0]++;
            acc[slot][1] += d.runs() == null ? 0L : d.runs();
            if (d.notOut()) {
                acc[slot][2]++;
            } else {
                acc[slot][3]++;
            }
            if (d.runs() != null && (highest[slot] == null || d.runs() > highest[slot])) {
                highest[slot] = d.runs();
            }
        }
        List<MyStatsDto.MyStatsBattingPositionGroup> groups = new ArrayList<>();
        for (int slot = 0; slot <= TAIL_LAST; slot++) {
            if (slot == 1 || slot == 2 || acc[slot][0] == 0) {
                continue;
            }
            String key = slot == 0 ? "OPENER" : String.valueOf(slot);
            String label = slot == 0 ? "Opener" : String.valueOf(slot);
            groups.add(new MyStatsDto.MyStatsBattingPositionGroup(
                    key, label, acc[slot][0], acc[slot][1], acc[slot][2], acc[slot][3],
                    battingAverage(acc[slot][1], acc[slot][3]), highest[slot]));
        }
        return groups;
    }

    private static String venueKey(UUID areaId) {
        return areaId == null ? "unknown" : areaId.toString();
    }

    private static String venueName(String name) {
        return name == null || name.isBlank() ? UNKNOWN_VENUE : name;
    }

    /** Runs at each playing area, most runs first, at most {@value #VENUE_CAP} venues and the rest as "Other venues". */
    public static List<MyStatsDto.MyStatsBattingVenue> battingVenues(Collection<InningsDetail> innings) {
        Map<String, long[]> acc = new LinkedHashMap<>(); // innings, notOuts, dismissals, runs
        Map<String, String> names = new HashMap<>();
        Map<String, Boolean> homes = new HashMap<>();
        for (InningsDetail d : innings) {
            String key = venueKey(d.areaId());
            names.putIfAbsent(key, venueName(d.areaName()));
            homes.putIfAbsent(key, d.areaId() == null ? null : d.clubField());
            long[] c = acc.computeIfAbsent(key, k -> new long[4]);
            c[0]++;
            if (d.notOut()) {
                c[1]++;
            } else {
                c[2]++;
            }
            c[3] += d.runs() == null ? 0L : d.runs();
        }
        List<MyStatsDto.MyStatsBattingVenue> all = new ArrayList<>();
        acc.forEach((key, c) -> all.add(new MyStatsDto.MyStatsBattingVenue(
                key, names.get(key), homes.get(key), c[0], c[1], c[2], c[3], battingAverage(c[3], c[2]))));
        all.sort(Comparator.comparingLong(MyStatsDto.MyStatsBattingVenue::runs).reversed()
                .thenComparing(MyStatsDto.MyStatsBattingVenue::name, String.CASE_INSENSITIVE_ORDER));
        if (all.size() <= VENUE_CAP) {
            return all;
        }
        List<MyStatsDto.MyStatsBattingVenue> capped = new ArrayList<>(all.subList(0, VENUE_CAP));
        long[] rest = new long[4];
        for (MyStatsDto.MyStatsBattingVenue v : all.subList(VENUE_CAP, all.size())) {
            rest[0] += v.innings();
            rest[1] += v.notOuts();
            rest[2] += v.dismissals();
            rest[3] += v.runs();
        }
        capped.add(new MyStatsDto.MyStatsBattingVenue(
                "other", OTHER_VENUES, null, rest[0], rest[1], rest[2], rest[3], battingAverage(rest[3], rest[2])));
        return capped;
    }

    /** Spells (balls, maidens, runs, wickets, overs) summed; overs use each match's own balls per over. */
    private static final class SpellSum {
        long spells;
        long balls;
        long maidens;
        long runs;
        long wickets;
        BigDecimal overs = BigDecimal.ZERO;
        final java.util.Set<Integer> overLengths = new java.util.TreeSet<>();

        void add(PlayerMatchRowDto.PlayerMatchSpell s, int ballsPerOver) {
            spells++;
            balls += s.balls();
            maidens += s.maidens();
            runs += s.runs();
            wickets += s.wickets();
            BigDecimal o = matchOvers(s.balls(), ballsPerOver);
            if (o != null) {
                overs = overs.add(o);
            }
            if (s.balls() > 0) {
                overLengths.add(ballsPerOver);
            }
        }

        Integer ballsPerOver() {
            return overLengths.size() == 1 ? overLengths.iterator().next() : null;
        }

        BigDecimal economy() {
            return balls > 0 ? PlayerStatsCalculator.economy(runs, overs) : null;
        }
    }

    private static MyStatsDto.MyStatsBowlingSplit bowlingSplit(SpellSum c) {
        return new MyStatsDto.MyStatsBowlingSplit(
                c.spells, c.balls, c.ballsPerOver(), c.maidens, c.runs, c.wickets, c.economy(), divide(c.runs, c.wickets, 2));
    }

    /** Bowling at the club's own home fields versus elsewhere; spells of matches with no playing area are only counted. */
    public static MyStatsDto.MyStatsBowlingHomeAway bowlingHomeAway(
            Collection<PlayerMatchRowDto> rows, Collection<ResultVenue> venues) {
        Map<UUID, ResultVenue> byResult = new HashMap<>();
        venues.forEach(v -> byResult.putIfAbsent(v.resultId(), v));
        SpellSum home = new SpellSum();
        SpellSum away = new SpellSum();
        long unknown = 0;
        for (PlayerMatchRowDto row : rows) {
            if (row.bowling().spells() == null) {
                continue;
            }
            ResultVenue v = byResult.get(row.resultId());
            for (PlayerMatchRowDto.PlayerMatchSpell s : row.bowling().spells()) {
                if (v == null || v.areaId() == null) {
                    unknown++;
                } else {
                    (v.clubField() ? home : away).add(s, row.ballsPerOver());
                }
            }
        }
        return new MyStatsDto.MyStatsBowlingHomeAway(bowlingSplit(home), bowlingSplit(away), unknown);
    }

    /** Bowling at each playing area, most wickets first then best economy, capped like {@link #battingVenues}. */
    public static List<MyStatsDto.MyStatsBowlingVenue> bowlingVenues(
            Collection<PlayerMatchRowDto> rows, Collection<ResultVenue> venues) {
        Map<UUID, ResultVenue> byResult = new HashMap<>();
        venues.forEach(v -> byResult.putIfAbsent(v.resultId(), v));
        Map<String, SpellSum> acc = new LinkedHashMap<>();
        Map<String, String> names = new HashMap<>();
        Map<String, Boolean> homes = new HashMap<>();
        for (PlayerMatchRowDto row : rows) {
            if (row.bowling().spells() == null) {
                continue;
            }
            ResultVenue v = byResult.get(row.resultId());
            UUID areaId = v == null ? null : v.areaId();
            String key = venueKey(areaId);
            names.putIfAbsent(key, venueName(v == null ? null : v.areaName()));
            homes.putIfAbsent(key, areaId == null ? null : v.clubField());
            SpellSum sum = acc.computeIfAbsent(key, k -> new SpellSum());
            for (PlayerMatchRowDto.PlayerMatchSpell s : row.bowling().spells()) {
                sum.add(s, row.ballsPerOver());
            }
        }
        List<MyStatsDto.MyStatsBowlingVenue> all = new ArrayList<>();
        acc.forEach((key, c) -> all.add(bowlingVenue(key, names.get(key), homes.get(key), c)));
        all.sort(Comparator.comparingLong(MyStatsDto.MyStatsBowlingVenue::wickets).reversed()
                .thenComparing(MyStatsDto.MyStatsBowlingVenue::economy, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(MyStatsDto.MyStatsBowlingVenue::name, String.CASE_INSENSITIVE_ORDER));
        if (all.size() <= VENUE_CAP) {
            return all;
        }
        List<MyStatsDto.MyStatsBowlingVenue> capped = new ArrayList<>(all.subList(0, VENUE_CAP));
        SpellSum rest = new SpellSum();
        for (String key : acc.keySet()) {
            boolean kept = capped.stream().anyMatch(v -> v.venueKey().equals(key));
            if (!kept) {
                SpellSum c = acc.get(key);
                rest.spells += c.spells;
                rest.balls += c.balls;
                rest.maidens += c.maidens;
                rest.runs += c.runs;
                rest.wickets += c.wickets;
                rest.overs = rest.overs.add(c.overs);
                rest.overLengths.addAll(c.overLengths);
            }
        }
        capped.add(bowlingVenue("other", OTHER_VENUES, null, rest));
        return capped;
    }

    private static MyStatsDto.MyStatsBowlingVenue bowlingVenue(String key, String name, Boolean home, SpellSum c) {
        return new MyStatsDto.MyStatsBowlingVenue(
                key, name, home, c.spells, c.balls, c.ballsPerOver(), c.runs, c.wickets, c.economy());
    }

    // ---- season by season ----

    /** One entry per season, oldest first (a season with no start date last); the average is runs per dismissal. */
    public static List<MyStatsDto.MyStatsSeason> bySeason(Collection<SeasonCounters> seasons) {
        List<SeasonCounters> sorted = new ArrayList<>(seasons);
        sorted.sort(Comparator.comparing(SeasonCounters::startDate, Comparator.nullsLast(Comparator.naturalOrder())));
        List<MyStatsDto.MyStatsSeason> result = new ArrayList<>(sorted.size());
        for (SeasonCounters s : sorted) {
            result.add(new MyStatsDto.MyStatsSeason(
                    s.seasonId(), s.label(), s.matches(), s.innings(), s.runs(), battingAverage(s.runs(), s.dismissals()), s.wickets()));
        }
        return result;
    }

    // ---- bowling discipline ----

    /**
     * Wides and no-balls charged to the bowler (byes and leg byes are never charged to a bowler, so they appear nowhere
     * here). The totals are the whole-scope counters; the per-over figures use only the spells that recorded that figure;
     * {@code inningsRecorded} counts the spells that recorded both.
     */
    public static MyStatsDto.MyStatsBowlingDiscipline bowlingDiscipline(
            PlayerStatsCounters counters, List<PlayerMatchRowDto> rowsOldestFirst) {
        List<MyStatsDto.MyStatsDisciplineSpell> spells = new ArrayList<>();
        long counted = 0;
        long recorded = 0;
        long wides = 0;
        long noBalls = 0;
        BigDecimal widesOvers = BigDecimal.ZERO;
        BigDecimal noBallsOvers = BigDecimal.ZERO;
        for (PlayerMatchRowDto row : rowsOldestFirst) {
            if (row.bowling().spells() == null) {
                continue;
            }
            for (PlayerMatchRowDto.PlayerMatchSpell spell : row.bowling().spells()) {
                counted++;
                BigDecimal overs = matchOvers(spell.balls(), row.ballsPerOver());
                if (spell.wides() != null) {
                    wides += spell.wides();
                    widesOvers = overs == null ? widesOvers : widesOvers.add(overs);
                }
                if (spell.noBalls() != null) {
                    noBalls += spell.noBalls();
                    noBallsOvers = overs == null ? noBallsOvers : noBallsOvers.add(overs);
                }
                if (spell.wides() != null && spell.noBalls() != null) {
                    recorded++;
                }
                spells.add(new MyStatsDto.MyStatsDisciplineSpell(
                        row.matchId(), row.matchDate(), row.opponentName(), spell.balls(), row.ballsPerOver(), spell.wides(), spell.noBalls()));
            }
        }
        return new MyStatsDto.MyStatsBowlingDiscipline(
                counters.bowling().wides(),
                counters.bowling().noBalls(),
                perOver(wides, widesOvers),
                perOver(noBalls, noBallsOvers),
                recorded,
                counted,
                spells);
    }

    private static BigDecimal perOver(long count, BigDecimal overs) {
        if (overs == null || overs.signum() <= 0) {
            return null;
        }
        return BigDecimal.valueOf(count).divide(overs, 2, RoundingMode.HALF_UP);
    }

    // ---- availability, fixtures, card counts ----

    /**
     * "Always there": the closed polls the player was asked, answered and answered "available", and the started matches the
     * player was selected for, in the chosen scope (null filters keep everything; LEAGUE keeps league matches, FRIENDLY
     * keeps friendlies), beside the counted matches played.
     */
    public static MyStatsDto.MyStatsAvailability availability(
            Collection<PollFact> polls,
            Collection<SelectionFact> selections,
            long matchesPlayed,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            com.cricketlegend.service.support.StatsScope.Competition competition) {
        long total = 0;
        long answered = 0;
        long available = 0;
        for (PollFact p : polls) {
            if (!inScope(p.seasonId(), p.leagueId(), p.teamId(), seasonId, leagueId, teamId, competition)) {
                continue;
            }
            total++;
            if (p.status() != null) {
                answered++;
                if (p.status() == AvailabilityStatus.AVAILABLE) {
                    available++;
                }
            }
        }
        java.util.Set<UUID> selected = new java.util.HashSet<>();
        for (SelectionFact s : selections) {
            if (inScope(s.seasonId(), s.leagueId(), s.teamId(), seasonId, leagueId, teamId, competition)) {
                selected.add(s.matchId());
            }
        }
        return new MyStatsDto.MyStatsAvailability(total, answered, available, selected.size(), matchesPlayed);
    }

    /** Upcoming matches (their league ids, null for a friendly) that pass the League and Competition filters. */
    public static long fixturesRemaining(
            Collection<UUID> upcomingLeagueIds,
            UUID leagueId,
            com.cricketlegend.service.support.StatsScope.Competition competition) {
        long count = 0;
        for (UUID league : upcomingLeagueIds) {
            if (inScope(null, league, null, null, leagueId, null, competition)) {
                count++;
            }
        }
        return count;
    }

    private static boolean inScope(
            UUID factSeason,
            UUID factLeague,
            UUID factTeam,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            com.cricketlegend.service.support.StatsScope.Competition competition) {
        return (seasonId == null || seasonId.equals(factSeason))
                && (leagueId == null || leagueId.equals(factLeague))
                && (teamId == null || teamId.equals(factTeam))
                && (competition == null
                        || (competition == com.cricketlegend.service.support.StatsScope.Competition.LEAGUE) == (factLeague != null));
    }

    /** Counted matches whose fielding credits were captured (a scorecard exists for the player's side). */
    public static long resultsWithFieldingCard(Collection<PlayerMatchRowDto> rows) {
        return rows.stream()
                .filter(r -> r.fielding().status() == PlayerMatchRowDto.PlayerMatchFieldingStatus.RECORDED)
                .count();
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
