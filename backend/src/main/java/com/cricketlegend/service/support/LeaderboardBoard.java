package com.cricketlegend.service.support;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * docs/specs/103-player-stats.md, "Boards": the one catalogue of leaderboards, served by the API so no client
 * hard-codes a definition. Pure: it states what a board is (group, label, direction, which minimum applies, the tie-breaks
 * in words, whether it can be an award); {@link LeaderboardRanker} applies the ordering and the figures come only from
 * {@link PlayerStatsCalculator}. The order here is the display order.
 */
public enum LeaderboardBoard {

    // ---- batting ----
    MOST_RUNS(Group.BATTING, "Most runs", "Runs", Direction.HIGHEST, MinimumKind.NONE, true, true,
            "Ranked by runs. Ties: fewer innings, then the higher highest score."),
    HIGHEST_SCORE(Group.BATTING, "Highest score", "Highest score", Direction.HIGHEST, MinimumKind.NONE, true, true,
            "Ranked by highest score. Ties: not out before out, then fewer balls faced (when recorded)."),
    BATTING_AVERAGE(Group.BATTING, "Batting average", "Average", Direction.HIGHEST, MinimumKind.INNINGS, true, true,
            "Ranked by runs per dismissal. Ties: more runs, then more innings. A batter never dismissed has no average"
                    + " and is listed last, unranked."),
    STRIKE_RATE(Group.BATTING, "Strike rate", "Strike rate", Direction.HIGHEST, MinimumKind.INNINGS, true, false,
            "Ranked by runs per 100 balls, over the innings that recorded balls. Ties: more runs, then more innings."),
    MOST_FOURS(Group.BATTING, "Most fours", "Fours", Direction.HIGHEST, MinimumKind.NONE, true, false,
            "Ranked by fours, over the innings that recorded them. Ties: fewer innings, then more runs."),
    MOST_SIXES(Group.BATTING, "Most sixes", "Sixes", Direction.HIGHEST, MinimumKind.NONE, true, false,
            "Ranked by sixes, over the innings that recorded them. Ties: fewer innings, then more runs."),
    MOST_30S(Group.BATTING, "Most 30+ scores", "30+ scores", Direction.HIGHEST, MinimumKind.NONE, false, false,
            "Ranked by innings of 30 or more. Ties: more runs, then fewer innings."),
    MOST_50S(Group.BATTING, "Most 50+ scores", "50+ scores", Direction.HIGHEST, MinimumKind.NONE, true, false,
            "Ranked by innings of 50 or more (centuries included). Ties: more runs, then fewer innings."),
    MOST_100S(Group.BATTING, "Most 100+ scores", "100+ scores", Direction.HIGHEST, MinimumKind.NONE, true, false,
            "Ranked by innings of 100 or more. Ties: more runs, then fewer innings."),
    MOST_NOT_OUTS(Group.BATTING, "Most not outs", "Not outs", Direction.HIGHEST, MinimumKind.NONE, false, false,
            "Ranked by not-out innings. Ties: more runs, then fewer innings."),

    // ---- bowling ----
    MOST_WICKETS(Group.BOWLING, "Most wickets", "Wickets", Direction.HIGHEST, MinimumKind.NONE, true, true,
            "Ranked by wickets. Ties: fewer runs conceded, then fewer balls bowled."),
    BEST_BOWLING(Group.BOWLING, "Best bowling", "Best bowling", Direction.HIGHEST, MinimumKind.NONE, true, true,
            "Ranked by the most wickets in an innings. Ties: fewer runs conceded, then more balls bowled in that innings."),
    BOWLING_AVERAGE(Group.BOWLING, "Bowling average", "Average", Direction.LOWEST, MinimumKind.OVERS, true, false,
            "Ranked by runs conceded per wicket, lowest first. Ties: more wickets, then more overs. A bowler with no"
                    + " wickets has no average and is listed last, unranked."),
    ECONOMY_RATE(Group.BOWLING, "Economy rate", "Economy", Direction.LOWEST, MinimumKind.OVERS, true, true,
            "Ranked by runs per over, lowest first. Ties: more wickets, then more overs."),
    BOWLING_STRIKE_RATE(Group.BOWLING, "Bowling strike rate", "Balls per wicket", Direction.LOWEST,
            MinimumKind.OVERS, true, false,
            "Ranked by balls per wicket, lowest first. Ties: more wickets, then more overs. A bowler with no wickets has"
                    + " no strike rate and is listed last, unranked."),
    MOST_MAIDENS(Group.BOWLING, "Most maidens", "Maidens", Direction.HIGHEST, MinimumKind.NONE, true, false,
            "Ranked by maiden overs. Ties: more overs bowled, then more wickets."),
    MOST_3W(Group.BOWLING, "Most 3-wicket hauls", "3-wicket hauls", Direction.HIGHEST, MinimumKind.NONE, false, false,
            "Ranked by innings of exactly 3 wickets. Ties: more wickets, then fewer runs conceded."),
    MOST_4W(Group.BOWLING, "Most 4-wicket hauls", "4-wicket hauls", Direction.HIGHEST, MinimumKind.NONE, false, false,
            "Ranked by innings of exactly 4 wickets. Ties: more wickets, then fewer runs conceded."),
    MOST_5W(Group.BOWLING, "Most 5-wicket hauls", "5-wicket hauls", Direction.HIGHEST, MinimumKind.NONE, true, false,
            "Ranked by innings of 5 or more wickets. Ties: more wickets, then fewer runs conceded."),
    MOST_DOT_BALLS(Group.BOWLING, "Most dot balls", "Dot balls", Direction.HIGHEST, MinimumKind.NONE, false, false,
            "Ranked by dot balls, over the innings that recorded them. Ties: higher dot ball percentage, then more overs."),

    // ---- fielding ----
    MOST_CATCHES(Group.FIELDING, "Most catches", "Catches", Direction.HIGHEST, MinimumKind.NONE, true, true,
            "Ranked by catches. Ties: fewer matches."),
    MOST_STUMPINGS(Group.FIELDING, "Most stumpings", "Stumpings", Direction.HIGHEST, MinimumKind.NONE, true, false,
            "Ranked by stumpings. Ties: fewer matches."),
    MOST_RUN_OUTS(Group.FIELDING, "Most run outs", "Run outs", Direction.HIGHEST, MinimumKind.NONE, true, false,
            "Ranked by run outs. Ties: fewer matches."),
    MOST_FIELDING_DISMISSALS(Group.FIELDING, "Most fielding dismissals", "Dismissals", Direction.HIGHEST,
            MinimumKind.NONE, true, true,
            "Ranked by catches, stumpings and run outs together. Ties: fewer matches, then more catches."),

    // ---- awards ----
    MOST_POTM(Group.AWARDS, "Most player of the match", "Awards", Direction.HIGHEST, MinimumKind.NONE, true, true,
            "Ranked by official player of the match awards. Ties: more team player of the match awards, then fewer"
                    + " matches."),
    MOST_TEAM_POTM(Group.AWARDS, "Most team player of the match", "Awards", Direction.HIGHEST, MinimumKind.NONE, true,
            false,
            "Ranked by the club team's own player of the match awards. Ties: more official awards, then fewer matches.");

    /** The four tabs of the Leaderboards page. */
    public enum Group {
        BATTING("Batting"),
        BOWLING("Bowling"),
        FIELDING("Fielding"),
        AWARDS("Awards");

        private final String label;

        Group(String label) {
            this.label = label;
        }

        public String getLabel() {
            return label;
        }
    }

    /** Which end of the figure is best. */
    public enum Direction {
        HIGHEST,
        LOWEST
    }

    /** What the optional minimum on a board counts: nothing (no minimum), batting innings, or overs bowled. */
    public enum MinimumKind {
        NONE,
        INNINGS,
        OVERS
    }

    private final Group group;
    private final String label;
    private final String figureLabel;
    private final Direction direction;
    private final MinimumKind minimumKind;
    private final boolean awardEligible;
    private final boolean awardDefault;
    private final String help;

    LeaderboardBoard(
            Group group,
            String label,
            String figureLabel,
            Direction direction,
            MinimumKind minimumKind,
            boolean awardEligible,
            boolean awardDefault,
            String help) {
        this.group = group;
        this.label = label;
        this.figureLabel = figureLabel;
        this.direction = direction;
        this.minimumKind = minimumKind;
        this.awardEligible = awardEligible;
        this.awardDefault = awardDefault;
        this.help = help;
    }

    /** The board code used in the API: the constant's name. */
    public String getCode() {
        return name();
    }

    public Group getGroup() {
        return group;
    }

    public String getLabel() {
        return label;
    }

    public String getFigureLabel() {
        return figureLabel;
    }

    public Direction getDirection() {
        return direction;
    }

    public MinimumKind getMinimumKind() {
        return minimumKind;
    }

    /** Help text for the board, stating its tie-breaks. */
    public String getHelp() {
        return help;
    }

    /** True when a club may choose this board as an award category. */
    public boolean isAwardEligible() {
        return awardEligible;
    }

    /** True for the nine headline categories shown when a club has made no choice. */
    public boolean isAwardDefault() {
        return awardDefault;
    }

    /** A plain count board (no rate, no single innings): only players with at least one of the thing are listed. */
    public boolean isCounting() {
        return minimumKind == MinimumKind.NONE && this != HIGHEST_SCORE && this != BEST_BOWLING;
    }

    /** The board with this code, if any (exact, case sensitive). */
    public static Optional<LeaderboardBoard> byCode(String code) {
        return Arrays.stream(values()).filter(board -> board.name().equals(code)).findFirst();
    }

    /** Every board in display order. */
    public static List<LeaderboardBoard> all() {
        return List.of(values());
    }

    /** The headline categories shown when a club has not chosen: the nine defaults, in display order. */
    public static List<LeaderboardBoard> awardDefaults() {
        return Arrays.stream(values()).filter(LeaderboardBoard::isAwardDefault).toList();
    }

    /** The categories a club may choose from, in display order. */
    public static List<LeaderboardBoard> awardEligibleBoards() {
        return Arrays.stream(values()).filter(LeaderboardBoard::isAwardEligible).toList();
    }
}
