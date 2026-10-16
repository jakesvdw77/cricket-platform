package com.cricketlegend.service.adaptor;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultDecidedBy;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.TossDecision;
import com.cricketlegend.dto.ImportErrorDto;
import com.cricketlegend.dto.ImportedResultDto;
import com.cricketlegend.dto.ImportedResultDto.Awards;
import com.cricketlegend.dto.ImportedResultDto.Batting;
import com.cricketlegend.dto.ImportedResultDto.Bowling;
import com.cricketlegend.dto.ImportedResultDto.Extras;
import com.cricketlegend.dto.ImportedResultDto.Innings;
import com.cricketlegend.dto.ImportedResultDto.Margin;
import com.cricketlegend.dto.ImportedResultDto.PlayerOfMatch;
import com.cricketlegend.dto.ImportedResultDto.Result;
import com.cricketlegend.dto.ImportedResultDto.Team;
import com.cricketlegend.dto.ImportedResultDto.Toss;
import com.cricketlegend.exception.ImportInputValidationException;
import com.cricketlegend.service.adaptor.StumpsLines.Line;
import com.cricketlegend.service.support.OversFormat;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * docs/specs/108-match-results-stumps-pdf-adaptor.md: reads the numbered lines of one STUMPS match report into the common
 * import document. It knows nothing of PDFs, so every rule is tested with plain text. The report is a summary page (the
 * two teams and their scores, the result, the player of the match, a block of labelled facts), then for each innings a
 * batting card (a name line, a dismissal line and a figures line per batter), the extras and total, the fall of wickets
 * and a bowling table; after the second innings come ball-by-ball pages, which are ignored.
 *
 * <p>Every line is understood or reported with its page and line, and nothing is guessed: a dismissal wording the
 * adaptor does not know, a result it does not know and a line it does not recognise before the ball-by-ball pages are all
 * errors. A name is never put in an error message, only the wording of a dismissal (a keyword) and the numbers. Row level
 * problems (a bad number, an unknown dismissal) are collected and reported together; a structural problem (a missing
 * section, an unrecognised line) stops the read at once with everything found so far. Cricket arithmetic is
 * {@code ResultValidator}'s, not checked here.
 */
final class StumpsReportParser {

    static final String PROVIDER = "STUMPS";
    private static final String REJECTED = "The file is not a STUMPS match report this adaptor can read.";
    private static final String SUMMARY = "summary";

    private static final Pattern SCORE = Pattern.compile("^(\\d{1,6})-(\\d{1,2}) in (\\d{1,3}(?:\\.\\d)?) overs?$");
    private static final Pattern WON_BY = Pattern.compile(
            "^(.+?) won by (\\d{1,6}) (wickets?|runs?)(?: \\(D/L Method\\))?$", Pattern.CASE_INSENSITIVE);
    private static final Pattern DLS = Pattern.compile("\\(D/L Method\\)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern LABEL = Pattern.compile(
            "^(Organiser|Match Title|Match Format|Playing 11|Overs|Venue|Date & Time|Toss|Scorer|Match ID)(?: (.*))?$");
    private static final Pattern DATE_TIME = Pattern.compile(
            "^(\\d{1,2}) ([A-Za-z]{3}) (\\d{4}) (\\d{1,2}):(\\d{2}) (AM|PM)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern TOSS = Pattern.compile("^(.+?) \\S+ To (Bat|Bowl)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern INNINGS_HEADER = Pattern.compile("^(\\d{1,2})(?:st|nd|rd|th) Innings Scorecard$");
    private static final Pattern CARD_COLUMNS = Pattern.compile("^(.+) R B 4s 6s SR$");
    private static final Pattern FIGURES = Pattern.compile("^(\\d{1,6}) (\\d{1,6}) (\\d{1,6}) (\\d{1,6}) \\S+$");
    private static final Pattern NUMERIC_LIKE = Pattern.compile("^[\\d.\\-,]+$");
    private static final Pattern WHOLE_NUMBER = Pattern.compile("^\\d{1,6}$");
    private static final Pattern EXTRAS_LINE = Pattern.compile("^\\((.*)\\)$");
    private static final Pattern EXTRAS_PART = Pattern.compile("^(B|LB|WD|NB) (\\S+)$");
    private static final Pattern EXTRAS_TOTAL = Pattern.compile("^(\\d{1,6}) Overs (\\S+)$");
    private static final Pattern INNINGS_TOTAL = Pattern.compile("^(\\d{1,6})/(\\d{1,2})$");
    private static final Pattern RUN_RATE = Pattern.compile("^Run Rate \\S+$");
    private static final Pattern BOWLING_HEADER = Pattern.compile("^Bowler O M R W Ec(?:o|on) 0s 4s 6s Wd NB$");
    private static final Pattern BALL_BY_BALL = Pattern.compile("^(Over Comparison|Over \\d+)\\b.*$");

    private static final Pattern DISMISSAL_START = Pattern.compile(
            "^(not out|b .+|c .+|lbw .+|runout.*|st .+|stumped.*|hit .*|retired.*|timed .*|handled.*|obstruct.*|absent.*)$");
    private static final Pattern CAUGHT_AND_BOWLED = Pattern.compile("^c & b (.+)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern CAUGHT = Pattern.compile("^c (.+?) b (.+)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern BOWLED = Pattern.compile("^b (.+)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern LBW = Pattern.compile("^lbw (.+)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern RUN_OUT = Pattern.compile("^runout \\((.+)\\)$", Pattern.CASE_INSENSITIVE);
    /** The only words of a dismissal that an error may quote: the words of a dismissal, never a name. */
    private static final Set<String> QUOTABLE_WORDS = Set.of("st", "stumped", "hit", "retired", "timed", "handled",
            "obstructing", "obstruct", "absent", "abandoned", "run", "out", "caught", "bowled", "lbw", "c", "b", "ro");
    private static final int MOST_BATTER_LINES = 6;

    private static final Map<String, Integer> MONTHS = Map.ofEntries(
            Map.entry("jan", 1), Map.entry("feb", 2), Map.entry("mar", 3), Map.entry("apr", 4), Map.entry("may", 5),
            Map.entry("jun", 6), Map.entry("jul", 7), Map.entry("aug", 8), Map.entry("sep", 9), Map.entry("oct", 10),
            Map.entry("nov", 11), Map.entry("dec", 12));

    private final List<Line> lines;
    private final List<ImportErrorDto> errors = new ArrayList<>();
    private int pos;
    private String teamAName;
    private String teamBName;

    private StumpsReportParser(List<Line> lines) {
        this.lines = lines;
    }

    // ---- the banner ----

    /**
     * The lines without the banner STUMPS prints at the top of every page: the download line (when present),
     * {@code Match report created from} and {@code STUMPS}. A page's own content is untouched.
     */
    static List<Line> withoutBanner(List<Line> raw) {
        List<Line> kept = new ArrayList<>(raw.size());
        for (int i = 0; i < raw.size(); i++) {
            String text = raw.get(i).text();
            boolean created = text.equalsIgnoreCase("Match report created from") && i + 1 < raw.size()
                    && raw.get(i + 1).text().equalsIgnoreCase("STUMPS");
            if (created) {
                if (!kept.isEmpty() && kept.get(kept.size() - 1).text().regionMatches(true, 0, "Download 'STUMPS", 0, 16)
                        && kept.get(kept.size() - 1).page() == raw.get(i).page()) {
                    kept.remove(kept.size() - 1);
                }
                i++;
            } else {
                kept.add(raw.get(i));
            }
        }
        return kept;
    }

    /** Throws {@code NOT_A_STUMPS_REPORT} unless the lines carry the STUMPS banner and open with {@code Match Report}. */
    static void requireStumpsReport(List<Line> raw) {
        boolean banner = false;
        for (int i = 0; i + 1 < raw.size() && i < 8; i++) {
            if (raw.get(i).text().equalsIgnoreCase("Match report created from")
                    && raw.get(i + 1).text().equalsIgnoreCase("STUMPS")) {
                banner = true;
            }
        }
        List<Line> body = withoutBanner(raw);
        if (!banner || body.isEmpty() || !body.get(0).text().equalsIgnoreCase("Match Report")) {
            throw new ImportInputValidationException(REJECTED, List.of(new ImportErrorDto("", "NOT_A_STUMPS_REPORT",
                    "This is not a STUMPS match report. It should start with the STUMPS banner ('Match report created"
                            + " from STUMPS') and then 'Match Report'. Export the report from the STUMPS app as a PDF.")));
        }
    }

    /** The common document for the lines, or an {@link ImportInputValidationException} naming every problem found. */
    static ImportedResultDto parse(List<Line> raw) {
        requireStumpsReport(raw);
        return new StumpsReportParser(withoutBanner(raw)).read();
    }

    // ---- the whole report ----

    private ImportedResultDto read() {
        pos = 1;
        teamAName = readTeamName();
        teamBName = readTeamName();
        if (TeamNames.same(teamAName, teamBName)) {
            throw fail(SUMMARY, "TEAMS_SAME_NAME", "The two teams have the same name, so the sides cannot be told apart.");
        }
        expectLine("Result", "the 'Result' line after the two team scores");
        Line firstResultLine = lines.get(Math.min(pos, lines.size() - 1));
        String resultText = readUntil("Player Of The Match", 4, "the 'Player Of The Match' line after the result");
        String playerOfMatch = readUntil("Match Information", 3, "the 'Match Information' line after the player of the match");
        Map<String, Labelled> facts = readFacts();
        readMatchSummary();

        Integer scheduledOvers = scheduledOvers(facts);
        Result result = resultOf(firstResultLine, resultText, scheduledOvers);
        LocalDateAndTime when = dateAndTime(facts.get("Date & Time"));
        Toss toss = tossOf(facts.get("Toss"));
        String matchId = facts.get("Match ID").value();
        if (matchId.isEmpty()) {
            throw fail(facts.get("Match ID").line().path(), "UNRECOGNISED_LINE", "The 'Match ID' line has no match id.");
        }
        String venue = facts.containsKey("Venue") && !facts.get("Venue").value().isEmpty() ? facts.get("Venue").value() : null;

        List<Innings> innings = new ArrayList<>();
        innings.add(readInnings(1));
        innings.add(readInnings(2));
        if (pos < lines.size() && INNINGS_HEADER.matcher(lines.get(pos).text()).matches()) {
            throw fail(lines.get(pos).path(), "UNRECOGNISED_LINE",
                    "There is a third innings. A report with a super over or more than two innings is not supported.");
        }
        if (!errors.isEmpty()) {
            throw new ImportInputValidationException(REJECTED, errors);
        }
        Awards awards = playerOfMatch.isEmpty() || playerOfMatch.equals("-")
                ? null : new Awards(new PlayerOfMatch(playerOfMatch, null), null);
        return new ImportedResultDto(
                ImportedResultDto.SCHEMA_VERSION,
                new ImportedResultDto.Source(null, PROVIDER, matchId, null),
                new ImportedResultDto.Match(null, when.date(), when.time(), venue, null, null),
                List.of(new Team("A", teamAName, null, null), new Team("B", teamBName, null, null)),
                toss, result, innings, null, awards);
    }

    // ---- the summary page ----

    /** A team name: the lines before its score line, joined (a long name may wrap). */
    private String readTeamName() {
        StringBuilder name = new StringBuilder();
        int start = pos;
        while (pos < lines.size()) {
            Line line = lines.get(pos);
            if (SCORE.matcher(line.text()).matches()) {
                pos++;
                if (name.length() == 0) {
                    throw fail(line.path(), "UNRECOGNISED_LINE", "A team score has no team name before it.");
                }
                return name.toString();
            }
            if (line.text().equals("Result") || pos - start >= 3) {
                break;
            }
            name.append(name.length() == 0 ? "" : " ").append(line.text());
            pos++;
        }
        throw fail(pos < lines.size() ? lines.get(pos).path() : SUMMARY, "UNRECOGNISED_LINE",
                "Expected a team name and then its score, such as '120-6 in 30.0 overs'.");
    }

    private void expectLine(String text, String what) {
        if (pos >= lines.size() || !lines.get(pos).text().equalsIgnoreCase(text)) {
            throw fail(pos < lines.size() ? lines.get(pos).path() : SUMMARY, "UNRECOGNISED_LINE", "Expected " + what + ".");
        }
        pos++;
    }

    /** The lines up to a marker line (at most {@code most} of them), joined with a space; the marker is consumed. */
    private String readUntil(String marker, int most, String what) {
        List<String> parts = new ArrayList<>();
        while (pos < lines.size()) {
            Line line = lines.get(pos);
            pos++;
            if (line.text().equalsIgnoreCase(marker)) {
                return String.join(" ", parts);
            }
            parts.add(line.text());
            if (parts.size() > most) {
                throw fail(line.path(), "UNRECOGNISED_LINE", "Expected " + what + ", but it is not there.");
            }
        }
        throw fail(SUMMARY, "MISSING_SECTION", "The report ends before " + what + ".");
    }

    /** The value of a labelled fact and the line it was on. */
    private record Labelled(Line line, String value) {
    }

    /** The labelled facts between {@code Match Information} and {@code Match Summary}; a wrapped value continues. */
    private Map<String, Labelled> readFacts() {
        Map<String, StringBuilder> values = new LinkedHashMap<>();
        Map<String, Line> where = new LinkedHashMap<>();
        StringBuilder current = null;
        boolean ended = false;
        while (pos < lines.size()) {
            Line line = lines.get(pos);
            pos++;
            if (line.text().equals("Match Summary")) {
                ended = true;
                break;
            }
            if (INNINGS_HEADER.matcher(line.text()).matches()) {
                pos--;
                break;
            }
            Matcher label = LABEL.matcher(line.text());
            if (label.matches()) {
                String key = label.group(1);
                if (values.containsKey(key)) {
                    throw fail(line.path(), "UNRECOGNISED_LINE", "The label '" + key + "' appears twice.");
                }
                current = new StringBuilder(label.group(2) == null ? "" : label.group(2).trim());
                values.put(key, current);
                where.put(key, line);
            } else if (current == null) {
                throw fail(line.path(), "UNRECOGNISED_LINE",
                        "Expected a labelled line such as 'Overs 20' or 'Venue ...' in the match information.");
            } else {
                current.append(current.length() == 0 ? "" : " ").append(line.text());
            }
        }
        if (!ended) {
            throw fail(SUMMARY, "MISSING_SECTION", "The report has no 'Match Summary' line.");
        }
        for (String required : List.of("Overs", "Date & Time", "Toss", "Match ID")) {
            if (!values.containsKey(required)) {
                throw fail(SUMMARY, "MISSING_SECTION", "The match information has no '" + required + "' line.");
            }
        }
        Map<String, Labelled> facts = new LinkedHashMap<>();
        values.forEach((key, value) -> facts.put(key, new Labelled(where.get(key), value.toString().trim())));
        return facts;
    }

    /** Skips the match summary and its top performers, which repeat the scorecards, up to the first innings. */
    private void readMatchSummary() {
        while (pos < lines.size() && !INNINGS_HEADER.matcher(lines.get(pos).text()).matches()) {
            pos++;
        }
        if (pos >= lines.size()) {
            throw fail(SUMMARY, "MISSING_SECTION", "The report has no '1st Innings Scorecard'.");
        }
    }

    private Integer scheduledOvers(Map<String, Labelled> facts) {
        Labelled overs = facts.get("Overs");
        if (!WHOLE_NUMBER.matcher(overs.value()).matches() || Integer.parseInt(overs.value()) < 1) {
            error(overs.line(), "BAD_NUMBER", "The overs of the match must be a whole number of 1 or more.");
            return null;
        }
        return Integer.parseInt(overs.value());
    }

    private Result resultOf(Line line, String text, Integer scheduledOvers) {
        Matcher won = WON_BY.matcher(text);
        if (!won.matches()) {
            throw fail(line.path(), "RESULT_NOT_UNDERSTOOD", "The result is not 'won by N wickets' or 'won by N runs', with"
                    + " or without '(D/L Method)'. A tie, a no result and other results are not supported yet.");
        }
        String winner = keyOf(won.group(1));
        if (winner == null) {
            throw fail(line.path(), "WINNER_NOT_FOUND", "The winner in the result is not one of the two teams on the"
                    + " summary page.");
        }
        ResultMarginType type = won.group(3).toLowerCase(Locale.ROOT).startsWith("run")
                ? ResultMarginType.RUNS : ResultMarginType.WICKETS;
        ResultDecidedBy decidedBy = DLS.matcher(text).find() ? ResultDecidedBy.DLS : null;
        return new Result(ResultOutcomeType.WON, winner, decidedBy, new Margin(type, Integer.parseInt(won.group(2))), null,
                scheduledOvers, null, null, null);
    }

    private Toss tossOf(Labelled toss) {
        Matcher match = TOSS.matcher(toss.value());
        if (!match.matches()) {
            throw fail(toss.line().path(), "TOSS_NOT_UNDERSTOOD",
                    "The toss line should read '<team> <word> To Bat' or '<team> <word> To Bowl'.");
        }
        String key = keyOf(match.group(1));
        if (key == null) {
            throw fail(toss.line().path(), "TOSS_NOT_UNDERSTOOD",
                    "The team that won the toss is not one of the two teams on the summary page.");
        }
        return new Toss(key, match.group(2).equalsIgnoreCase("Bat") ? TossDecision.BAT : TossDecision.BOWL, null);
    }

    private record LocalDateAndTime(LocalDate date, LocalTime time) {
    }

    private LocalDateAndTime dateAndTime(Labelled value) {
        Matcher match = DATE_TIME.matcher(value.value());
        Integer month = match.matches() ? MONTHS.get(match.group(2).toLowerCase(Locale.ROOT)) : null;
        if (month == null) {
            throw fail(value.line().path(), "INVALID_DATE",
                    "The date and time should read like '10 Oct 2026 01:30 PM'.");
        }
        int hour = Integer.parseInt(match.group(4));
        int minute = Integer.parseInt(match.group(5));
        if (hour < 1 || hour > 12 || minute > 59) {
            throw fail(value.line().path(), "INVALID_DATE", "The time must be on a 12 hour clock, such as 01:30 PM.");
        }
        boolean pm = match.group(6).equalsIgnoreCase("PM");
        int hour24 = hour % 12 + (pm ? 12 : 0);
        try {
            return new LocalDateAndTime(
                    LocalDate.of(Integer.parseInt(match.group(3)), month, Integer.parseInt(match.group(1))),
                    LocalTime.of(hour24, minute));
        } catch (DateTimeException ex) {
            throw fail(value.line().path(), "INVALID_DATE", "The date is not a real date.");
        }
    }

    private String keyOf(String name) {
        return TeamNames.same(name, teamAName) ? "A" : TeamNames.same(name, teamBName) ? "B" : null;
    }

    // ---- an innings ----

    private Innings readInnings(int ordinal) {
        if (pos >= lines.size()) {
            throw fail(SUMMARY, "MISSING_SECTION", "The report has no '" + ordinalName(ordinal) + " Innings Scorecard'.");
        }
        Line header = lines.get(pos);
        Matcher title = INNINGS_HEADER.matcher(header.text());
        if (!title.matches() || Integer.parseInt(title.group(1)) != ordinal) {
            throw fail(header.path(), "UNRECOGNISED_LINE", "Expected '" + ordinalName(ordinal) + " Innings Scorecard'.");
        }
        pos++;
        if (pos >= lines.size()) {
            throw fail(header.path(), "MISSING_SECTION", "The innings has no column header after its title.");
        }
        Line columns = lines.get(pos);
        Matcher team = CARD_COLUMNS.matcher(columns.text());
        if (!team.matches()) {
            throw fail(columns.path(), "UNRECOGNISED_LINE", "Expected the batting column header, '<team> R B 4s 6s SR'.");
        }
        String battingKey = keyOf(team.group(1));
        if (battingKey == null) {
            throw fail(columns.path(), "TEAM_NOT_FOUND",
                    "The team on the batting card is not one of the two teams on the summary page.");
        }
        pos++;
        List<Batting> batting = readBatters();
        Extras extras = readExtras();
        Totals totals = readTotals();
        skipFallOfWickets();
        List<Bowling> bowling = readBowling(ordinal);
        return new Innings(battingKey, InningsKind.REGULAR, totals.runs(), totals.wickets(), totals.overs(), extras, batting,
                List.of(), bowling,
                null, null, null);
    }

    private static String ordinalName(int ordinal) {
        return ordinal == 1 ? "1st" : "2nd";
    }

    // ---- batting ----

    private List<Batting> readBatters() {
        List<Batting> rows = new ArrayList<>();
        while (true) {
            if (pos >= lines.size()) {
                throw fail(lines.get(lines.size() - 1).path(), "MISSING_SECTION",
                        "The report ends inside a batting card, before its 'Extras' line.");
            }
            Line first = lines.get(pos);
            if (first.text().equals("Extras")) {
                pos++;
                return rows;
            }
            List<Line> group = new ArrayList<>();
            group.add(first);
            pos++;
            Line figures = null;
            while (pos < lines.size() && figures == null) {
                Line line = lines.get(pos);
                if (FIGURES.matcher(line.text()).matches() || looksLikeFigures(line.text())) {
                    figures = line;
                    pos++;
                } else if (line.text().equals("Extras") || group.size() >= MOST_BATTER_LINES) {
                    break;
                } else {
                    group.add(line);
                    pos++;
                }
            }
            if (figures == null || group.size() < 2) {
                throw fail(first.path(), "BATTER_INCOMPLETE", "A batter should be a name line, a dismissal line and a"
                        + " figures line (runs, balls, fours, sixes, strike rate), but this one is not.");
            }
            rows.add(batter(group, figures));
        }
    }

    /** Five tokens whose first four are numeric-like: a figures line with a bad number in it. */
    private static boolean looksLikeFigures(String text) {
        String[] tokens = text.split(" ");
        if (tokens.length != 5) {
            return false;
        }
        for (int i = 0; i < 4; i++) {
            if (!NUMERIC_LIKE.matcher(tokens[i]).matches()) {
                return false;
            }
        }
        return true;
    }

    private Batting batter(List<Line> group, Line figures) {
        // the dismissal starts at the first later line that begins with a dismissal word; otherwise the last line is it
        int start = group.size() - 1;
        for (int i = 1; i < group.size(); i++) {
            if (DISMISSAL_START.matcher(group.get(i).text()).matches()) {
                start = i;
                break;
            }
        }
        for (int i = start + 1; i < group.size(); i++) {
            if (DISMISSAL_START.matcher(group.get(i).text()).matches()) {
                throw fail(group.get(0).path(), "BATTER_INCOMPLETE", "A batter should be a name line, a dismissal line and"
                        + " a figures line, but the lines from here hold more than one dismissal, so a figures line is"
                        + " missing.");
            }
        }
        String name = join(group.subList(0, start));
        String dismissal = join(group.subList(start, group.size()));
        Line dismissalLine = group.get(start);

        int[] numbers = figures(figures);
        DismissalType type = null;
        String bowler = null;
        String fielder = null;
        Matcher m;
        if (dismissal.equalsIgnoreCase("not out")) {
            type = DismissalType.NOT_OUT;
        } else if ((m = CAUGHT_AND_BOWLED.matcher(dismissal)).matches()) {
            type = DismissalType.CAUGHT_AND_BOWLED;
            bowler = m.group(1);
        } else if ((m = CAUGHT.matcher(dismissal)).matches()) {
            type = DismissalType.CAUGHT;
            fielder = m.group(1);
            bowler = m.group(2);
        } else if ((m = BOWLED.matcher(dismissal)).matches()) {
            type = DismissalType.BOWLED;
            bowler = m.group(1);
        } else if ((m = LBW.matcher(dismissal)).matches()) {
            type = DismissalType.LBW;
            bowler = m.group(1);
        } else if ((m = RUN_OUT.matcher(dismissal)).matches()) {
            type = DismissalType.RUN_OUT;
            fielder = m.group(1);
        } else {
            error(dismissalLine, "UNKNOWN_DISMISSAL", "The dismissal wording " + quotedWording(dismissal)
                    + " is not one this adaptor knows. It knows 'b', 'c ... b', 'c & b', 'lbw', 'runout (...)' and"
                    + " 'not out'. A new form is added deliberately, with a masked sample.");
        }
        return new Batting(name, null, type, bowler, fielder, numbers[0], numbers[1], numbers[2], numbers[3]);
    }

    /** The first word of the dismissal in quotes when it is a word of a dismissal, never a name. */
    private static String quotedWording(String dismissal) {
        String word = dismissal.split(" ")[0].toLowerCase(Locale.ROOT);
        return QUOTABLE_WORDS.contains(word) ? "'" + word + "'" : "(not a word this adaptor recognises)";
    }

    private int[] figures(Line line) {
        Matcher match = FIGURES.matcher(line.text());
        if (!match.matches()) {
            error(line, "BAD_NUMBER", "The batter's figures should be four whole numbers (runs, balls, fours, sixes)"
                    + " and a strike rate.");
            return new int[4];
        }
        return new int[] {Integer.parseInt(match.group(1)), Integer.parseInt(match.group(2)),
                Integer.parseInt(match.group(3)), Integer.parseInt(match.group(4))};
    }

    private static String join(List<Line> parts) {
        return String.join(" ", parts.stream().map(Line::text).toList());
    }

    // ---- extras, total, fall of wickets ----

    private Extras readExtras() {
        Line line = nextLine("the extras in brackets, such as '( B 1 | WD 4 )'");
        Matcher match = EXTRAS_LINE.matcher(line.text());
        if (!match.matches()) {
            throw fail(line.path(), "UNRECOGNISED_LINE", "Expected the extras in brackets, such as '( B 1 | WD 4 )'.");
        }
        int byes = 0;
        int legByes = 0;
        int wides = 0;
        int noBalls = 0;
        String inner = match.group(1).trim();
        if (!inner.isEmpty()) {
            for (String part : inner.split("\\|", -1)) {
                Matcher extra = EXTRAS_PART.matcher(part.trim());
                if (!extra.matches()) {
                    throw fail(line.path(), "UNRECOGNISED_LINE",
                            "Each of the extras should be 'B n', 'LB n', 'WD n' or 'NB n', separated by '|'.");
                }
                int value = wholeOrError(line, extra.group(2), "The " + extra.group(1) + " extras");
                switch (extra.group(1)) {
                    case "B" -> byes = value;
                    case "LB" -> legByes = value;
                    case "WD" -> wides = value;
                    default -> noBalls = value;
                }
            }
        }
        return new Extras(wides, noBalls, byes, legByes, null);
    }

    private record Totals(int runs, int wickets, String overs) {
    }

    /** The extras total and overs, the innings total and the run rate; the extras total itself is not used. */
    private Totals readTotals() {
        Line line = nextLine("the extras total and overs, such as '12 Overs 20.0'");
        Matcher total = EXTRAS_TOTAL.matcher(line.text());
        if (!total.matches()) {
            throw fail(line.path(), "UNRECOGNISED_LINE", "Expected the extras total and the overs, such as '12 Overs 20.0'.");
        }
        String overs = total.group(2);
        OversFormat.Parsed parsed = OversFormat.parse(overs, 6);
        if (!parsed.valid()) {
            error(line, "BAD_NUMBER", "The innings overs are not valid. " + parsed.error());
        }
        Line totalTitle = nextLine("the 'Total' line");
        if (!totalTitle.text().equals("Total")) {
            throw fail(totalTitle.path(), "UNRECOGNISED_LINE", "Expected the 'Total' line.");
        }
        Line figures = nextLine("the total as runs/wickets, such as '120/6'");
        Matcher runs = INNINGS_TOTAL.matcher(figures.text());
        if (!runs.matches()) {
            throw fail(figures.path(), "BAD_NUMBER", "The total should be runs/wickets, such as '120/6'.");
        }
        Line rate = nextLine("the 'Run Rate' line");
        if (!RUN_RATE.matcher(rate.text()).matches()) {
            throw fail(rate.path(), "UNRECOGNISED_LINE", "Expected the 'Run Rate' line.");
        }
        return new Totals(Integer.parseInt(runs.group(1)), Integer.parseInt(runs.group(2)), overs);
    }

    /** Ignores the fall of wickets (which wraps over lines) up to the bowling table's column header, which is consumed. */
    private void skipFallOfWickets() {
        Line title = nextLine("the 'Fall Of Wickets' line");
        if (!title.text().equals("Fall Of Wickets")) {
            throw fail(title.path(), "UNRECOGNISED_LINE", "Expected the 'Fall Of Wickets' line.");
        }
        while (pos < lines.size()) {
            Line line = lines.get(pos);
            if (BOWLING_HEADER.matcher(line.text()).matches()) {
                pos++;
                return;
            }
            if (INNINGS_HEADER.matcher(line.text()).matches()) {
                break;
            }
            pos++;
        }
        throw fail(pos < lines.size() ? lines.get(pos).path() : lines.get(lines.size() - 1).path(), "MISSING_SECTION",
                "The innings has no bowling table: expected 'Bowler O M R W Eco 0s 4s 6s Wd NB'.");
    }

    // ---- bowling ----

    private List<Bowling> readBowling(int ordinal) {
        List<Bowling> rows = new ArrayList<>();
        while (pos < lines.size()) {
            Line line = lines.get(pos);
            if (INNINGS_HEADER.matcher(line.text()).matches()) {
                break;
            }
            if (ordinal == 2 && BALL_BY_BALL.matcher(line.text()).matches()) {
                // the ball-by-ball pages start here: everything from this line on is ignored
                pos = lines.size();
                return rows;
            }
            String[] tokens = line.text().split(" ");
            if (tokens.length < 11 || !lastTenNumeric(tokens)) {
                throw fail(line.path(), "UNRECOGNISED_LINE", "Expected a bowler's line: a name and ten figures (overs,"
                        + " maidens, runs, wickets, economy, dots, fours, sixes, wides, no balls).");
            }
            Bowling row = bowler(line, tokens);
            if (row != null) {
                rows.add(row);
            }
            pos++;
        }
        if (ordinal == 1 && pos >= lines.size()) {
            throw fail(lines.get(lines.size() - 1).path(), "MISSING_SECTION", "The report ends before the 2nd innings.");
        }
        return rows;
    }

    private static boolean lastTenNumeric(String[] tokens) {
        for (int i = tokens.length - 10; i < tokens.length; i++) {
            if (!NUMERIC_LIKE.matcher(tokens[i]).matches()) {
                return false;
            }
        }
        return true;
    }

    private Bowling bowler(Line line, String[] tokens) {
        int first = tokens.length - 10;
        String name = String.join(" ", java.util.Arrays.copyOfRange(tokens, 0, first));
        String overs = tokens[first];
        OversFormat.Parsed parsed = OversFormat.parse(overs, 6);
        boolean valid = overs.matches("^\\d{1,3}(\\.\\d)?$") && parsed.valid();
        if (!valid) {
            error(line, "BAD_NUMBER", "The overs '" + overs + "' are not valid. Overs look like 4 or 3.4.");
        }
        // columns after the overs: M R W Econ 0s 4s 6s Wd NB; the economy and the boundaries are not used
        String[] columns = {"M", "R", "W", "Econ", "0s", "4s", "6s", "Wd", "NB"};
        int[] numbers = new int[9];
        for (int i = 0; i < columns.length; i++) {
            if (i == 3) {
                continue;
            }
            String token = tokens[first + 1 + i];
            if (!WHOLE_NUMBER.matcher(token).matches()) {
                error(line, "BAD_NUMBER", "'" + token + "' is not a whole number, but the " + columns[i]
                        + " column must be.");
                valid = false;
            } else {
                numbers[i] = Integer.parseInt(token);
            }
        }
        if (!valid) {
            return null;
        }
        return new Bowling(name, overs, numbers[0], numbers[1], numbers[2], numbers[7], numbers[8], numbers[4]);
    }

    // ---- helpers ----

    private Line nextLine(String what) {
        if (pos >= lines.size()) {
            throw fail(lines.get(lines.size() - 1).path(), "MISSING_SECTION", "The report ends before " + what + ".");
        }
        return lines.get(pos++);
    }

    private int wholeOrError(Line line, String token, String what) {
        if (!WHOLE_NUMBER.matcher(token).matches()) {
            error(line, "BAD_NUMBER", what + " should be a whole number.");
            return 0;
        }
        return Integer.parseInt(token);
    }

    private void error(Line line, String code, String message) {
        errors.add(new ImportErrorDto(line.path(), code, message));
    }

    private ImportInputValidationException fail(String path, String code, String message) {
        errors.add(new ImportErrorDto(path, code, message));
        return new ImportInputValidationException(REJECTED, errors);
    }
}
