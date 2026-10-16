package com.cricketlegend.service.adaptor;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.dto.ImportedResultDto.Batting;
import com.cricketlegend.dto.ImportedResultDto.Margin;
import com.cricketlegend.dto.ImportedResultDto.Result;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * docs/specs/107-match-results-cricclubs-csv-adaptor.md, "Mapping to the common format": the CricClubs rules that do not
 * depend on how the scorecard was read. The dismissal code map, caught-and-bowled when the fielder is the bowler, a
 * substitute fielder left empty, did-not-bat against not-out, the retired-batter rule decided from the stated wickets,
 * and the result text with its winner and margin. It knows nothing of lines or files, so a second reader of the same
 * scorecard (a later PDF adaptor) can reuse it. A problem is returned as a {@link Problem} for the reader to attach to
 * its own location; nothing here throws.
 */
final class CricClubsScorecardMapper {

    static final String PROVIDER = "CRICCLUBS";
    private static final String SUBSTITUTE = "Substitute";

    private static final Pattern FORFEIT = Pattern.compile("(?i)Forfeited\\.\\s*Winner:\\s*(.+)$");
    private static final Pattern TIE = Pattern.compile("(?i)It is a Tie$");
    private static final Pattern WON_BY = Pattern.compile("(?i)^(.*?)\\s*won by\\s+(\\d{1,6})\\s+(Runs?|Wickets?)$");
    private static final Pattern OVERS_FORMAT = Pattern.compile("(?i)^O/(\\d{1,3})$");

    private CricClubsScorecardMapper() {}

    /** Why something could not be mapped: a stable code and a plain message, for the reader to place. */
    record Problem(String code, String message) {
    }

    // ---- the result ----

    /** The mapped result, or the reason there is none. */
    record Outcome(Result result, Problem problem) {
    }

    /** {@code T20} is 20 overs, {@code O/N} is N; any other format word is not known, so null. */
    static Integer scheduledOvers(String formatWord) {
        if ("T20".equalsIgnoreCase(formatWord)) {
            return 20;
        }
        Matcher format = OVERS_FORMAT.matcher(formatWord);
        return format.matches() && Integer.parseInt(format.group(1)) > 0 ? Integer.parseInt(format.group(1)) : null;
    }

    /**
     * The result from its text (without the date), against the two team names. The match type glued in front of the
     * winner ({@code LeaguePolice 3}) is ignored by matching the team name at the end of the text, the longer name
     * winning a tie.
     */
    static Outcome result(String text, String teamA, String teamB, Integer scheduledOvers) {
        Matcher forfeit = FORFEIT.matcher(text);
        if (forfeit.find()) {
            String winner = same(forfeit.group(1), teamA) ? "A" : same(forfeit.group(1), teamB) ? "B" : null;
            if (winner == null) {
                return problem("WINNER_NOT_FOUND", "The forfeit winner '" + forfeit.group(1).trim()
                        + "' is not one of the two teams, '" + teamA + "' and '" + teamB + "'.");
            }
            return new Outcome(new Result(ResultOutcomeType.FORFEIT, winner, null, null, null, scheduledOvers, null, null,
                    null), null);
        }
        if (TIE.matcher(text).find()) {
            return new Outcome(new Result(ResultOutcomeType.TIE, null, null, null, null, scheduledOvers, null, null, null),
                    null);
        }
        Matcher won = WON_BY.matcher(text);
        if (!won.matches()) {
            return problem("RESULT_NOT_UNDERSTOOD", "The result '" + text + "' is not 'won by N Runs', 'won by N Wickets',"
                    + " 'It is a Tie' or 'Forfeited. Winner: <team>'.");
        }
        String winner = winnerAtEnd(won.group(1), teamA, teamB);
        if (winner == null) {
            return problem("WINNER_NOT_FOUND", "The winner in '" + won.group(1).trim() + "' does not end with either team"
                    + " name, '" + teamA + "' or '" + teamB + "'.");
        }
        ResultMarginType type = won.group(3).toLowerCase(Locale.ROOT).startsWith("run")
                ? ResultMarginType.RUNS
                : ResultMarginType.WICKETS;
        return new Outcome(new Result(ResultOutcomeType.WON, winner, null, new Margin(type, Integer.parseInt(won.group(2))),
                null, scheduledOvers, null, null, null), null);
    }

    private static Outcome problem(String code, String message) {
        return new Outcome(null, new Problem(code, message));
    }

    private static String winnerAtEnd(String text, String teamA, String teamB) {
        String normal = normal(text);
        boolean a = normal.endsWith(normal(teamA));
        boolean b = normal.endsWith(normal(teamB));
        if (a && b) {
            return normal(teamA).length() >= normal(teamB).length() ? "A" : "B";
        }
        return a ? "A" : b ? "B" : null;
    }

    /** True when the two team names are the same ignoring case and runs of spaces. */
    static boolean same(String first, String second) {
        return normal(first).equals(normal(second));
    }

    private static String normal(String text) {
        return text.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    // ---- a batting row ----

    /** One batter as mapped, before the retired batters are decided. {@code type} is null for a retirement. */
    record Row(String player, DismissalType type, String bowler, String fielder, int runs, int balls, int fours, int sixes) {

        boolean retired() {
            return type == null;
        }
    }

    /** A mapped row, or the reason there is none. */
    record RowOutcome(Row row, Problem problem) {
    }

    /** The dismissal codes this mapper knows, for the message of an unknown one. */
    static final String KNOWN_CODES = "b, ct, ctw, lbw, st, ro, rt and rtno";

    /** Maps one batting row by its dismissal code (any case). A blank fielder or bowler is passed as null. */
    static RowOutcome batter(String player, String rawCode, String fielder, String bowler, int runs, int balls, int fours,
            int sixes) {
        String code = rawCode.toLowerCase(Locale.ROOT);
        String field = fielder != null && fielder.equalsIgnoreCase(SUBSTITUTE) ? null : fielder;
        String bowl = bowler;
        DismissalType type;
        switch (code) {
            case "" -> type = runs > 0 || balls > 0 ? DismissalType.NOT_OUT : DismissalType.DID_NOT_BAT;
            case "b" -> type = DismissalType.BOWLED;
            case "lbw" -> type = DismissalType.LBW;
            case "st" -> type = DismissalType.STUMPED;
            case "ctw" -> type = DismissalType.CAUGHT;
            case "ct" -> {
                if (field != null && field.equalsIgnoreCase(bowl)) {
                    type = DismissalType.CAUGHT_AND_BOWLED;
                    field = null;
                } else {
                    type = DismissalType.CAUGHT;
                }
            }
            case "ro" -> {
                type = DismissalType.RUN_OUT;
                bowl = null;
            }
            case "rt", "rtno" -> type = null;
            default -> {
                return rowProblem("UNKNOWN_DISMISSAL", "Unknown dismissal code '" + rawCode + "'. This adaptor knows "
                        + KNOWN_CODES + ". A new code is added deliberately, with a sample.");
            }
        }
        boolean notDismissed = type == DismissalType.NOT_OUT || type == DismissalType.DID_NOT_BAT;
        if (notDismissed) {
            field = null;
            bowl = null;
        }
        if (type == null && (field != null || bowl != null)) {
            return rowProblem("UNEXPECTED_NAME",
                    "A retired batter ('" + code + "') has no fielder or bowler, but this row names one.");
        }
        if (type != null && !notDismissed) {
            Problem names = checkNames(code, type, field, bowl);
            if (names != null) {
                return new RowOutcome(null, names);
            }
        }
        return new RowOutcome(new Row(player, type, bowl, field, runs, balls, fours, sixes), null);
    }

    private static Problem checkNames(String code, DismissalType type, String fielder, String bowler) {
        if (fielder != null && !type.allowsFielder()) {
            return new Problem("UNEXPECTED_NAME", "A fielder cannot be named for '" + code + "'.");
        }
        if (bowler != null && !type.allowsBowler()) {
            return new Problem("UNEXPECTED_NAME", "A bowler cannot be named for '" + code + "'.");
        }
        if (type == DismissalType.CAUGHT && fielder == null && bowler == null) {
            return new Problem("FIELDER_OR_BOWLER_REQUIRED", "A catch ('" + code + "') needs a fielder or a bowler, and this"
                    + " row has neither (a substitute is left empty).");
        }
        return null;
    }

    private static RowOutcome rowProblem(String code, String message) {
        return new RowOutcome(null, new Problem(code, message));
    }

    // ---- the retired batters ----

    /** The batting rows and did-not-bat names of an innings, or the reason the retired batters cannot be decided. */
    record Decided(List<Batting> batting, List<String> didNotBat, Problem problem) {
    }

    /**
     * Decides every retired batter of an innings from the wickets the scorecard states (docs/specs/107). With the stated
     * wickets equal to the dismissals that are wickets, every retirement was not out; with them equal to that count plus
     * the retirements, every one was out; anything else is a problem, not a choice. An innings with no retirement is
     * not checked: wickets against dismissals is the validator's warning.
     */
    static Decided decideRetired(List<Row> rows, int statedWickets) {
        long retired = rows.stream().filter(Row::retired).count();
        long dismissed = rows.stream().filter(r -> !r.retired() && r.type().isWicket()).count();
        DismissalType retirement = DismissalType.RETIRED_NOT_OUT;
        if (retired > 0) {
            if (statedWickets == dismissed + retired) {
                retirement = DismissalType.RETIRED_OUT;
            } else if (statedWickets != dismissed) {
                return new Decided(null, null, new Problem("WICKETS_DO_NOT_MATCH_BATTERS",
                        "The extras line says " + statedWickets + " wickets, but the batters show " + dismissed
                                + " dismissals and " + retired + " retired. The wickets should be " + dismissed
                                + " (retired not out) or " + (dismissed + retired) + " (retired out), so the retired"
                                + " batters cannot be decided."));
            }
        }
        List<Batting> batting = new ArrayList<>();
        List<String> didNotBat = new ArrayList<>();
        for (Row row : rows) {
            if (row.type() == DismissalType.DID_NOT_BAT) {
                didNotBat.add(row.player());
            } else {
                batting.add(new Batting(row.player(), null, row.retired() ? retirement : row.type(), row.bowler(),
                        row.fielder(), row.runs(), row.balls(), row.fours(), row.sixes()));
            }
        }
        return new Decided(batting, didNotBat, null);
    }
}
