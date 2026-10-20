package com.cricketlegend.service.support;

import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardCell;
import com.cricketlegend.service.support.LeaderboardBoard.Direction;
import com.cricketlegend.service.support.LeaderboardBoard.Group;
import com.cricketlegend.service.support.LeaderboardBoard.MinimumKind;
import com.cricketlegend.service.support.LeaderboardRanker.Candidate;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * docs/specs/103-player-stats.md, "Standings tables (decision 26)": the fixed columns of the three standings tables, in
 * display order. Pure: it states which figure of {@link PlayerStatsCalculator.Figures} each column shows (never computing
 * one), which way it ranks, and which {@link LeaderboardBoard} (if any) defines its tie-breaks. A column with no board sorts
 * by the generic rule in {@link LeaderboardTableRanker}.
 */
public enum LeaderboardColumn {

    // ---- batting ----
    BAT_MATCHES(Group.BATTING, "matches", "Mat", "Matches", null),
    BAT_INNINGS(Group.BATTING, "innings", "Inns", "Innings", null),
    BAT_RUNS(Group.BATTING, "runs", "Runs", "Runs", LeaderboardBoard.MOST_RUNS),
    BAT_BALLS(Group.BATTING, "balls", "Balls", "Balls faced", null),
    BAT_HIGHEST_SCORE(Group.BATTING, "highestScore", "HS", "Highest score", LeaderboardBoard.HIGHEST_SCORE),
    BAT_AVERAGE(Group.BATTING, "average", "Avg", "Batting average", LeaderboardBoard.BATTING_AVERAGE),
    BAT_STRIKE_RATE(Group.BATTING, "strikeRate", "SR", "Strike rate", LeaderboardBoard.STRIKE_RATE),
    BAT_OUTS(Group.BATTING, "outs", "Outs", "Times out", null),
    BAT_FOURS(Group.BATTING, "fours", "4s", "Fours", LeaderboardBoard.MOST_FOURS),
    BAT_SIXES(Group.BATTING, "sixes", "6s", "Sixes", LeaderboardBoard.MOST_SIXES),
    BAT_FIFTY_PLUS(Group.BATTING, "fiftyPlus", "50+", "50+ scores", LeaderboardBoard.MOST_50S),
    BAT_HUNDRED_PLUS(Group.BATTING, "hundredPlus", "100+", "100+ scores", LeaderboardBoard.MOST_100S),

    // ---- bowling ----
    BOWL_MATCHES(Group.BOWLING, "matches", "Mat", "Matches", null),
    BOWL_OVERS(Group.BOWLING, "overs", "Overs", "Overs", null),
    BOWL_MAIDENS(Group.BOWLING, "maidens", "Mdn", "Maidens", LeaderboardBoard.MOST_MAIDENS),
    BOWL_DOTS(Group.BOWLING, "dots", "Dots", "Dot balls", LeaderboardBoard.MOST_DOT_BALLS),
    BOWL_RUNS(Group.BOWLING, "runs", "Runs", "Runs conceded", null),
    BOWL_WICKETS(Group.BOWLING, "wickets", "Wkts", "Wickets", LeaderboardBoard.MOST_WICKETS),
    BOWL_AVERAGE(Group.BOWLING, "average", "Avg", "Bowling average", LeaderboardBoard.BOWLING_AVERAGE),
    BOWL_ECONOMY(Group.BOWLING, "economy", "Econ", "Economy rate", LeaderboardBoard.ECONOMY_RATE),
    BOWL_STRIKE_RATE(Group.BOWLING, "strikeRate", "SR", "Bowling strike rate", LeaderboardBoard.BOWLING_STRIKE_RATE),
    BOWL_BEST(Group.BOWLING, "best", "Best", "Best bowling", LeaderboardBoard.BEST_BOWLING),
    BOWL_THREE_W(Group.BOWLING, "threeW", "3W", "3-wicket hauls", LeaderboardBoard.MOST_3W),
    BOWL_FOUR_W(Group.BOWLING, "fourW", "4W", "4-wicket hauls", LeaderboardBoard.MOST_4W),
    BOWL_FIVE_W(Group.BOWLING, "fiveW", "5W", "5-wicket hauls", LeaderboardBoard.MOST_5W),

    // ---- fielding ----
    FIELD_MATCHES(Group.FIELDING, "matches", "Mat", "Matches", null),
    FIELD_CATCHES(Group.FIELDING, "catches", "Catches", "Catches", LeaderboardBoard.MOST_CATCHES),
    FIELD_STUMPINGS(Group.FIELDING, "stumpings", "Stumpings", "Stumpings", LeaderboardBoard.MOST_STUMPINGS),
    FIELD_RUN_OUTS(Group.FIELDING, "runOuts", "Run-outs", "Run-outs", LeaderboardBoard.MOST_RUN_OUTS),
    FIELD_TOTAL(Group.FIELDING, "total", "Total", "Total dismissals", LeaderboardBoard.MOST_FIELDING_DISMISSALS);

    private final Group group;
    private final String code;
    private final String label;
    private final String longLabel;
    private final LeaderboardBoard board;

    LeaderboardColumn(Group group, String code, String label, String longLabel, LeaderboardBoard board) {
        this.group = group;
        this.code = code;
        this.label = label;
        this.longLabel = longLabel;
        this.board = board;
    }

    public Group getGroup() {
        return group;
    }

    /** The column code, also the {@code sort} request value. */
    public String getCode() {
        return code;
    }

    /** The short table heading (Mat, Inns, SR...). */
    public String getLabel() {
        return label;
    }

    /** The full name shown where there is room, such as the Sort by dropdown. */
    public String getLongLabel() {
        return longLabel;
    }

    /** The board that defines this column's ordering and tie-breaks, or null when the generic rule applies. */
    public LeaderboardBoard getBoard() {
        return board;
    }

    /** Lower is better only for the bowling average, economy and strike rate. */
    public Direction getDirection() {
        return board == null ? Direction.HIGHEST : board.getDirection();
    }

    /** The optional minimum available when sorting by this column (rates only). */
    public MinimumKind getMinimumKind() {
        return board == null ? MinimumKind.NONE : board.getMinimumKind();
    }

    /** The group's columns in display order. */
    public static List<LeaderboardColumn> of(Group group) {
        return Arrays.stream(values()).filter(column -> column.group == group).toList();
    }

    /** The column with this code in the group (exact, case sensitive). */
    public static Optional<LeaderboardColumn> byCode(Group group, String code) {
        return of(group).stream().filter(column -> column.code.equals(code)).findFirst();
    }

    /** The default sort column of a group: runs, wickets or total. */
    public static LeaderboardColumn defaultFor(Group group) {
        return switch (group) {
            case BATTING -> BAT_RUNS;
            case BOWLING -> BOWL_WICKETS;
            case FIELDING -> FIELD_TOTAL;
            case AWARDS -> throw new IllegalArgumentException("Awards has no standings columns");
        };
    }

    /** Does this player belong in this column's table at all (the group's data exists)? */
    public static boolean appearsIn(Group group, Candidate c) {
        return switch (group) {
            case BATTING -> c.figures().batting().innings() >= 1;
            case BOWLING -> c.figures().bowling().inningsBowled() >= 1;
            case FIELDING -> c.counters().matches() >= 1;
            case AWARDS -> false;
        };
    }

    /** This column's figure for the player, straight from the calculator's figures (null parts when not defined). */
    public LeaderboardCell cell(Candidate c) {
        var f = c.figures();
        var b = f.batting();
        var w = f.bowling();
        var fl = f.fielding();
        return switch (this) {
            case BAT_MATCHES, BOWL_MATCHES, FIELD_MATCHES -> number(c.counters().matches());
            case BAT_INNINGS -> number(b.innings());
            case BAT_RUNS -> number(b.runs());
            case BAT_BALLS -> number(b.ballsFaced());
            case BAT_HIGHEST_SCORE -> b.highestScore() == null
                    ? NOT_DEFINED
                    : new LeaderboardCell(null, b.highestScore().runs(), null, b.highestScore().notOut(), null, null);
            case BAT_AVERAGE -> number(b.average());
            case BAT_STRIKE_RATE -> number(b.strikeRate());
            case BAT_OUTS -> number(b.dismissals());
            case BAT_FOURS -> number(b.fours());
            case BAT_SIXES -> number(b.sixes());
            case BAT_FIFTY_PLUS -> number(b.fiftyPlus());
            case BAT_HUNDRED_PLUS -> number(b.hundredPlus());
            case BOWL_OVERS -> {
                Integer ballsPerOver = !w.mixedOverLengths() && w.ballsPerOver().size() == 1
                        ? w.ballsPerOver().get(0)
                        : null;
                yield new LeaderboardCell(
                        LeaderboardRanker.overs(c).setScale(2, RoundingMode.HALF_UP),
                        null,
                        null,
                        null,
                        w.ballsBowled(),
                        ballsPerOver);
            }
            case BOWL_MAIDENS -> number(w.maidens());
            case BOWL_DOTS -> w.coverage().inningsWithDots() >= 1 ? number(w.dots()) : NOT_DEFINED;
            case BOWL_RUNS -> number(w.runsConceded());
            case BOWL_WICKETS -> number(w.wickets());
            case BOWL_AVERAGE -> number(w.average());
            case BOWL_ECONOMY -> number(w.economy());
            case BOWL_STRIKE_RATE -> number(w.strikeRate());
            case BOWL_BEST -> w.best() == null
                    ? NOT_DEFINED
                    : new LeaderboardCell(null, w.best().runs(), w.best().wickets(), null, null, null);
            case BOWL_THREE_W -> number(w.threeWicketHauls());
            case BOWL_FOUR_W -> number(w.fourWicketHauls());
            case BOWL_FIVE_W -> number(w.fiveWicketHauls());
            case FIELD_CATCHES -> number(fl.catches());
            case FIELD_STUMPINGS -> number(fl.stumpings());
            case FIELD_RUN_OUTS -> number(fl.runOuts());
            case FIELD_TOTAL -> number(fl.dismissals());
        };
    }

    /** Is there a figure for this player in this column? */
    public boolean isDefined(Candidate c) {
        LeaderboardCell cell = cell(c);
        return cell.value() != null || cell.runs() != null || cell.wickets() != null;
    }

    /**
     * The number the column is sorted by in its first place: the value, the runs of a highest score or the wickets of a best
     * bowling; null when not defined. Reversing a sort flips this key only; the tie-breaks keep their order.
     */
    BigDecimal primaryValue(Candidate c) {
        LeaderboardCell cell = cell(c);
        if (cell.value() != null) {
            return cell.value();
        }
        Long part = this == BOWL_BEST ? cell.wickets() : cell.runs();
        return part == null ? null : BigDecimal.valueOf(part);
    }

    /** The plain number of a generic column (those with no board), null when not defined. */
    BigDecimal numericValue(Candidate c) {
        return cell(c).value();
    }

    private static final LeaderboardCell NOT_DEFINED = new LeaderboardCell(null, null, null, null, null, null);

    private static LeaderboardCell number(long value) {
        return number(BigDecimal.valueOf(value));
    }

    private static LeaderboardCell number(BigDecimal value) {
        return value == null ? NOT_DEFINED : new LeaderboardCell(value, null, null, null, null, null);
    }
}
