package com.cricketlegend.service.support;

import com.cricketlegend.dto.TeamStatsTableDto.TeamStatsCell;
import com.cricketlegend.service.support.LeaderboardBoard.Direction;
import com.cricketlegend.service.support.TeamStatsCalculator.NrrStatus;
import com.cricketlegend.service.support.TeamTableRanker.Candidate;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Optional;
import java.util.function.Function;

/**
 * docs/specs/116-team-stats.md, "The table (TeamStatsTableDto)": the fixed columns of the team table, in display order.
 * Pure: it states which figure of {@link TeamStatsCalculator.Figures} each column shows (never computing one), which way it
 * ranks, whether the optional minimum applies, when a team is unranked (the figure is not defined) and the tie-breaks, in
 * order. {@link TeamTableRanker} ranks with them.
 */
public enum TeamStatsColumn {

    PLAYED("played", "P", "Played", "Matches played: wins, losses, ties, draws and no results, forfeits included.",
            Direction.HIGHEST, false),
    WON("won", "W", "Won", "Matches won, a forfeit received included.", Direction.HIGHEST, false),
    LOST("lost", "L", "Lost", "Matches lost, a forfeit conceded included. Fewer is better.", Direction.LOWEST, false),
    TIED("tied", "T", "Tied", "Matches tied.", Direction.HIGHEST, false),
    DRAWN("drawn", "D", "Drawn", "Matches drawn.", Direction.HIGHEST, false),
    NO_RESULT("noResult", "NR", "No result",
            "Matches abandoned or without a result after at least one ball was bowled.", Direction.HIGHEST, false),
    WIN_PERCENT("winPercent", "Win %", "Win percentage",
            "Wins as a percentage of wins and losses. Ties, draws and no results are left out.", Direction.HIGHEST, true),
    RUNS("runs", "Runs", "Runs scored", "Runs scored in innings with runs, wickets and balls recorded.",
            Direction.HIGHEST, false),
    BATTING_AVERAGE("battingAverage", "Avg", "Batting average", "Runs scored per wicket lost.", Direction.HIGHEST, true),
    RUN_RATE("runRate", "RR", "Run rate", "Runs scored per over faced.", Direction.HIGHEST, true),
    HIGH_TOTAL("highTotal", "High", "Highest total",
            "The highest innings total in a match won, tied or drawn.", Direction.HIGHEST, false),
    WICKETS_TAKEN("wicketsTaken", "Wkts", "Wickets taken",
            "Wickets taken: every dismissal of the opposition, run-outs included.", Direction.HIGHEST, false),
    BOWLING_AVERAGE("bowlingAverage", "Bowl avg", "Bowling average",
            "Runs conceded per wicket taken. Lower is better.", Direction.LOWEST, true),
    ECONOMY("economy", "Econ", "Economy rate", "Runs conceded per over bowled. Lower is better.", Direction.LOWEST, true),
    NET_RUN_RATE("netRunRate", "NRR", "Net run rate",
            "Full-quota rule. Shown for one league in one season.", Direction.HIGHEST, true);

    private final String code;
    private final String label;
    private final String longLabel;
    private final String help;
    private final Direction direction;
    private final boolean rate;

    TeamStatsColumn(String code, String label, String longLabel, String help, Direction direction, boolean rate) {
        this.code = code;
        this.label = label;
        this.longLabel = longLabel;
        this.help = help;
        this.direction = direction;
        this.rate = rate;
    }

    /** The column code, also the {@code sort} request value. */
    public String getCode() {
        return code;
    }

    /** The short table heading (P, W, Win %...). */
    public String getLabel() {
        return label;
    }

    /** The full name shown where there is room, such as the Sort by dropdown. */
    public String getLongLabel() {
        return longLabel;
    }

    /** One line saying what the column counts. */
    public String getHelp() {
        return help;
    }

    /** The natural direction: LOWEST only for losses, bowling average and economy. */
    public Direction getDirection() {
        return direction;
    }

    /** NONE for a count, MATCHES for a rate (the optional Minimum matches applies when sorting by it). */
    public MinimumKind getMinimumKind() {
        return rate ? MinimumKind.MATCHES : MinimumKind.NONE;
    }

    /** What the optional minimum counts. */
    public enum MinimumKind {
        NONE,
        MATCHES
    }

    /** The default sort column: Wins (a counting column, so a one-match team on 100% never tops the table). */
    public static TeamStatsColumn defaultSort() {
        return WON;
    }

    /** The column with this code (exact, case sensitive). */
    public static Optional<TeamStatsColumn> byCode(String code) {
        return Arrays.stream(values()).filter(column -> column.code.equals(code)).findFirst();
    }

    // ---- the figures ----

    /** This column's figure for the team, straight from the calculator's figures (null parts when not defined). */
    public TeamStatsCell cell(Candidate c) {
        var f = c.figures();
        var r = f.record();
        var b = f.batting();
        var w = f.bowling();
        return switch (this) {
            case PLAYED -> number(r.played());
            case WON -> number(r.won());
            case LOST -> number(r.lost());
            case TIED -> number(r.tied());
            case DRAWN -> number(r.drawn());
            case NO_RESULT -> number(r.noResult());
            case WIN_PERCENT -> number(r.winPercent());
            case RUNS -> number(b.runs());
            case BATTING_AVERAGE -> number(b.battingAverage());
            case RUN_RATE -> number(b.runRate());
            case HIGH_TOTAL -> b.highestTotal() == null
                    ? NOT_DEFINED
                    : new TeamStatsCell(
                            BigDecimal.valueOf(b.highestTotal().runs()),
                            b.highestTotal().runs(),
                            b.highestTotal().wickets(),
                            null,
                            null,
                            null,
                            null);
            case WICKETS_TAKEN -> number(w.wicketsTaken());
            case BOWLING_AVERAGE -> number(w.bowlingAverage());
            case ECONOMY -> number(w.economy());
            case NET_RUN_RATE -> {
                var n = f.netRunRate();
                yield new TeamStatsCell(
                        n.status() == NrrStatus.SHOWN ? n.value() : null,
                        null,
                        null,
                        n.status().name(),
                        n.rule(),
                        n.matchesUsed(),
                        n.matchesCounted());
            }
        };
    }

    /** Is there a figure for this team in this column? An undefined team is unranked (never first, never infinite). */
    public boolean isDefined(Candidate c) {
        return primaryValue(c) != null;
    }

    /**
     * The number the column is sorted by in its first place; null when not defined. Reversing a sort flips this key only;
     * the tie-breaks keep their order.
     */
    BigDecimal primaryValue(Candidate c) {
        return cell(c).value();
    }

    /** The primary key in the given direction, an undefined value last. */
    Comparator<Candidate> primary(Direction on) {
        return on == Direction.LOWEST ? asc(this::primaryValue) : desc(this::primaryValue);
    }

    /**
     * The ranking criteria: the value in the natural direction, then the tie-breaks of the spec's table, in order. Two
     * teams with equal criteria share a rank; name and id are not criteria (they only order equal ranks).
     */
    Comparator<Candidate> criteria() {
        Comparator<Candidate> value = primary(direction);
        return switch (this) {
            case PLAYED, TIED, DRAWN, NO_RESULT -> value.thenComparing(desc(TeamStatsColumn::wins));
            case WON -> value.thenComparing(desc(TeamStatsColumn::winPercent)).thenComparing(asc(TeamStatsColumn::played));
            case LOST -> value.thenComparing(asc(TeamStatsColumn::played));
            case WIN_PERCENT -> value.thenComparing(desc(TeamStatsColumn::wins)).thenComparing(desc(TeamStatsColumn::played));
            case RUNS -> value.thenComparing(desc(TeamStatsColumn::runsPerInnings))
                    .thenComparing(asc(TeamStatsColumn::played));
            case BATTING_AVERAGE, RUN_RATE -> value.thenComparing(desc(TeamStatsColumn::runs))
                    .thenComparing(desc(TeamStatsColumn::played));
            case HIGH_TOTAL -> value.thenComparing(desc(TeamStatsColumn::highestTotalDate));
            case WICKETS_TAKEN -> value.thenComparing(asc(TeamStatsColumn::runsConceded));
            case BOWLING_AVERAGE, ECONOMY -> value.thenComparing(desc(TeamStatsColumn::wicketsTaken))
                    .thenComparing(desc(TeamStatsColumn::played));
            case NET_RUN_RATE -> value.thenComparing(desc(TeamStatsColumn::wins))
                    .thenComparing(desc(TeamStatsColumn::played));
        };
    }

    // ---- tie-break figures ----

    private static BigDecimal wins(Candidate c) {
        return BigDecimal.valueOf(c.figures().record().won());
    }

    private static BigDecimal played(Candidate c) {
        return BigDecimal.valueOf(c.figures().record().played());
    }

    private static BigDecimal winPercent(Candidate c) {
        return c.figures().record().winPercent();
    }

    private static BigDecimal runs(Candidate c) {
        Long runs = c.figures().batting().runs();
        return runs == null ? null : BigDecimal.valueOf(runs);
    }

    private static BigDecimal runsPerInnings(Candidate c) {
        return c.figures().batting().runsPerInnings();
    }

    private static BigDecimal highestTotalDate(Candidate c) {
        var total = c.figures().batting().highestTotal();
        return total == null ? null : BigDecimal.valueOf(total.matchDate().getEpochSecond());
    }

    private static BigDecimal wicketsTaken(Candidate c) {
        Long wickets = c.figures().bowling().wicketsTaken();
        return wickets == null ? null : BigDecimal.valueOf(wickets);
    }

    private static BigDecimal runsConceded(Candidate c) {
        Long runs = c.figures().bowling().runsConceded();
        return runs == null ? null : BigDecimal.valueOf(runs);
    }

    // ---- comparators and cells ----

    static Comparator<Candidate> asc(Function<Candidate, BigDecimal> key) {
        return Comparator.comparing(key, Comparator.nullsLast(Comparator.<BigDecimal>naturalOrder()));
    }

    static Comparator<Candidate> desc(Function<Candidate, BigDecimal> key) {
        return Comparator.comparing(key, Comparator.nullsLast(Comparator.<BigDecimal>reverseOrder()));
    }

    private static final TeamStatsCell NOT_DEFINED = new TeamStatsCell(null, null, null, null, null, null, null);

    private static TeamStatsCell number(Long value) {
        return value == null ? NOT_DEFINED : number(BigDecimal.valueOf(value));
    }

    private static TeamStatsCell number(long value) {
        return number(BigDecimal.valueOf(value));
    }

    private static TeamStatsCell number(BigDecimal value) {
        return value == null ? NOT_DEFINED : new TeamStatsCell(value, null, null, null, null, null, null);
    }
}
