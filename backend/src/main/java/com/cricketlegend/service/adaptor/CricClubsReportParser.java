package com.cricketlegend.service.adaptor;

import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.dto.ImportErrorDto;
import com.cricketlegend.dto.ImportedResultDto;
import com.cricketlegend.dto.ImportedResultDto.Batting;
import com.cricketlegend.dto.ImportedResultDto.Bowling;
import com.cricketlegend.dto.ImportedResultDto.Extras;
import com.cricketlegend.dto.ImportedResultDto.Innings;
import com.cricketlegend.dto.ImportedResultDto.Result;
import com.cricketlegend.dto.ImportedResultDto.Team;
import com.cricketlegend.exception.ImportInputValidationException;
import com.cricketlegend.service.adaptor.CricClubsLines.Line;
import com.cricketlegend.service.support.OversFormat;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * docs/specs/107-match-results-cricclubs-csv-adaptor.md: reads the text of one CricClubs report into the common import
 * document. The layout is a result line, a teams line, then for each team a batting block, an extras and total line, a
 * bowling block and a fall of wickets block. Sections are found by their title lines, never by position. Every line is
 * either understood or reported with its line number: nothing is guessed, and an unknown dismissal code is an error.
 *
 * <p>Row level problems (a bad number, an unknown code) are collected and reported together; a structural problem (a
 * missing section, a result line that is not understood) stops the read at once with everything found so far. Cricket
 * arithmetic (totals, wickets against dismissals, the margin) is {@code ResultValidator}'s, not checked here, except
 * that the stated wickets decide whether a retired batter was out. The line reader is {@link CricClubsLines}; the
 * mapping rules (dismissal codes, retired batters, the result and its winner) are {@link CricClubsScorecardMapper}'s,
 * kept apart so another reader of the same scorecard can reuse them.
 */
final class CricClubsReportParser {

    private static final String REJECTED = "The file is not a CricClubs scorecard this adaptor can read.";

    private static final Pattern RESULT_LINE = Pattern.compile("^([^:]+):\\s*(.*?)\\s*\\((\\d{1,2})/(\\d{1,2})/(\\d{4})\\)$");
    private static final Pattern TITLE = Pattern.compile("^,+\\s*(.+?)\\s+(Batting|Bowling)$");
    private static final Pattern FALL_OF_WICKETS = Pattern.compile("(?i)^(.+?)\\s+Fall of Wickets$");
    private static final Pattern EXTRAS = Pattern.compile(
            "^Byes:\\s*(\\d+)\\s*,\\s*Leg Byes:\\s*(\\d+)\\s*,\\s*Wickets\\s*:\\s*(\\d+)\\s+Wides\\s*:\\s*(\\d+)\\s*,"
                    + "\\s*No Balls:\\s*(\\d+)\\s+Penalty\\s*:\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+(?:\\.\\d+)?)$");
    private static final Pattern WHOLE_NUMBER = Pattern.compile("^\\d{1,6}$");

    private static final List<String> BATTING_HEADER =
            List.of("batsman", "how out", "fielder", "bowler", "runs", "balls", "fours", "sixers");
    private static final List<String> BOWLING_HEADER =
            List.of("bowler", "overs", "madiens", "runs", "wickets", "wides", "no balls", "hattricks", "dot balls");

    private final List<Line> lines;
    private final List<ImportErrorDto> errors = new ArrayList<>();
    private String teamAName;
    private String teamBName;

    private CricClubsReportParser(List<Line> lines) {
        this.lines = lines;
    }

    /** The common document for the text, or an {@link ImportInputValidationException} naming every problem found. */
    static ImportedResultDto parse(String text) {
        return new CricClubsReportParser(CricClubsLines.of(text == null ? "" : text)).read();
    }

    // ---- the whole report ----

    private ImportedResultDto read() {
        int resultIndex = nextNonBlank(0);
        if (resultIndex < 0) {
            throw fail("", "EMPTY_FILE", "The file is empty.");
        }
        Line resultLine = lines.get(resultIndex);
        ResultHeader header = parseResultLine(resultLine);
        int teamsIndex = nextNonBlank(resultIndex + 1);
        if (teamsIndex < 0) {
            throw fail(CricClubsLines.path(resultLine.number()), "TEAMS_LINE_MISSING",
                    "The line with the two teams, such as 'Team One Vs Team Two', is missing after the result line.");
        }
        parseTeamsLine(lines.get(teamsIndex));
        Result result = resultOf(resultLine, header);

        List<InningsParts> blocks = readSections(teamsIndex + 1);
        boolean forfeit = result.outcome() == ResultOutcomeType.FORFEIT;
        if (!forfeit) {
            checkBlocks(blocks);
        }
        if (!errors.isEmpty()) {
            throw new ImportInputValidationException(REJECTED, errors);
        }
        List<Innings> innings = forfeit ? List.of() : blocks.stream().map(InningsParts::toInnings).toList();
        return new ImportedResultDto(
                ImportedResultDto.SCHEMA_VERSION,
                new ImportedResultDto.Source(null, CricClubsScorecardMapper.PROVIDER, null, null),
                new ImportedResultDto.Match(null, header.date(), null, null, header.competition(), null),
                List.of(new Team("A", teamAName, null, null), new Team("B", teamBName, null, null)),
                null, result, innings, null, null);
    }

    // ---- the result line and the teams line ----

    private record ResultHeader(Integer scheduledOvers, String competition, String text, LocalDate date) {
    }

    private ResultHeader parseResultLine(Line line) {
        Matcher match = RESULT_LINE.matcher(line.text());
        if (!match.matches()) {
            throw fail(CricClubsLines.path(line.number()), "RESULT_LINE_NOT_UNDERSTOOD",
                    "The first line should look like 'T20:  LeagueTeam One won by 10 Runs (11/10/2026)'. This does not,"
                            + " so the file is not a CricClubs scorecard export.");
        }
        LocalDate date;
        try {
            date = LocalDate.of(Integer.parseInt(match.group(5)), Integer.parseInt(match.group(4)),
                    Integer.parseInt(match.group(3)));
        } catch (DateTimeException ex) {
            throw fail(CricClubsLines.path(line.number()), "INVALID_DATE",
                    "'" + match.group(3) + "/" + match.group(4) + "/" + match.group(5)
                            + "' is not a date. The date is written dd/mm/yyyy.");
        }
        String[] words = match.group(1).trim().split("\\s+");
        Integer overs = CricClubsScorecardMapper.scheduledOvers(words[0]);
        String competition = words.length > 1
                ? String.join(" ", Arrays.copyOfRange(words, 1, words.length))
                : null;
        return new ResultHeader(overs, competition, match.group(2), date);
    }

    private void parseTeamsLine(Line line) {
        String[] parts = line.text().split("\\s+Vs\\s+", -1);
        if (parts.length != 2 || parts[0].isBlank() || parts[1].isBlank()) {
            throw fail(CricClubsLines.path(line.number()), "TEAMS_LINE_NOT_UNDERSTOOD",
                    "The second line should name the two teams, such as 'Team One Vs Team Two'.");
        }
        teamAName = parts[0].trim();
        teamBName = parts[1].trim();
        if (CricClubsScorecardMapper.same(teamAName, teamBName)) {
            throw fail(CricClubsLines.path(line.number()), "TEAMS_LINE_NOT_UNDERSTOOD",
                    "The two teams have the same name, '" + teamAName + "'.");
        }
    }

    private Result resultOf(Line line, ResultHeader header) {
        CricClubsScorecardMapper.Outcome outcome =
                CricClubsScorecardMapper.result(header.text(), teamAName, teamBName, header.scheduledOvers());
        if (outcome.problem() != null) {
            throw fail(CricClubsLines.path(line.number()), outcome.problem().code(), outcome.problem().message());
        }
        return outcome.result();
    }

    private String keyOf(String name) {
        return CricClubsScorecardMapper.same(name, teamAName) ? "A"
                : CricClubsScorecardMapper.same(name, teamBName) ? "B" : null;
    }

    // ---- the sections ----

    /** The parts of one innings as read: the batting block, then the bowling block that follows it. */
    private static final class InningsParts {
        private final int line;
        private final String battingKey;
        private int runs;
        private int wickets;
        private String overs;
        private Extras extras;
        private final List<Batting> batting = new ArrayList<>();
        private final List<String> didNotBat = new ArrayList<>();
        private final List<Bowling> bowling = new ArrayList<>();
        private boolean bowlingRead;

        private InningsParts(int line, String battingKey) {
            this.line = line;
            this.battingKey = battingKey;
        }

        private Innings toInnings() {
            return new Innings(battingKey, InningsKind.REGULAR, runs, wickets, overs, extras, batting, didNotBat, bowling,
                    null, null, null);
        }
    }

    private List<InningsParts> readSections(int from) {
        List<InningsParts> blocks = new ArrayList<>();
        InningsParts open = null;
        int i = from;
        while (i < lines.size()) {
            Line line = lines.get(i);
            if (line.isBlank()) {
                i++;
                continue;
            }
            Matcher title = TITLE.matcher(line.text());
            if (title.matches() && title.group(2).equals("Batting")) {
                String key = teamOfTitle(line, title.group(1), "batting");
                if (blocks.stream().anyMatch(b -> b.battingKey.equals(key))) {
                    throw fail(CricClubsLines.path(line.number()), "DUPLICATE_SECTION",
                            "There is a second batting section for " + name(key) + ".");
                }
                if (blocks.size() == 2) {
                    throw fail(CricClubsLines.path(line.number()), "TOO_MANY_SECTIONS",
                            "There are more than two batting sections. A scorecard has at most two innings.");
                }
                open = new InningsParts(line.number(), key);
                blocks.add(open);
                i = readBatting(i, open);
            } else if (title.matches()) {
                String key = teamOfTitle(line, title.group(1), "bowling");
                if (open == null || open.bowlingRead) {
                    throw fail(CricClubsLines.path(line.number()), "SECTION_OUT_OF_PLACE",
                            "The bowling section for " + name(key) + " does not follow a batting section.");
                }
                if (key.equals(open.battingKey)) {
                    throw fail(CricClubsLines.path(line.number()), "SECTION_OUT_OF_PLACE",
                            "The bowling section is for " + name(key) + ", but " + name(key)
                                    + " is the side that batted just before it. It should be the other team.");
                }
                open.bowlingRead = true;
                i = readBowling(i, open);
            } else if (FALL_OF_WICKETS.matcher(line.text()).matches()) {
                i = skipFallOfWickets(i + 1);
            } else {
                throw fail(CricClubsLines.path(line.number()), "UNRECOGNISED_LINE",
                        "This line is not part of a CricClubs scorecard: expected a section title such as"
                                + " ',,,Team One Batting'.");
            }
        }
        return blocks;
    }

    /** Ignores the fall of wickets: it only repeats the batting block, so everything up to the next title is skipped. */
    private int skipFallOfWickets(int from) {
        int i = from;
        while (i < lines.size() && !TITLE.matcher(lines.get(i).text()).matches()) {
            i++;
        }
        return i;
    }

    private void checkBlocks(List<InningsParts> blocks) {
        if (blocks.isEmpty()) {
            throw fail("", "MISSING_SECTION", "There is no batting section. Expected ',,,<team> Batting'.");
        }
        for (InningsParts block : blocks) {
            if (!block.bowlingRead) {
                errors.add(new ImportErrorDto(CricClubsLines.path(block.line), "MISSING_SECTION",
                        "The batting section for " + name(block.battingKey) + " has no bowling section after it."
                                + " Expected ',,,<other team> Bowling'."));
            }
        }
    }

    private String teamOfTitle(Line line, String teamText, String section) {
        String key = keyOf(teamText);
        if (key == null) {
            throw fail(CricClubsLines.path(line.number()), "UNKNOWN_TEAM",
                    "The " + section + " section is for '" + teamText.trim() + "', which is not one of the two teams, '"
                            + teamAName + "' and '" + teamBName + "'.");
        }
        return key;
    }

    // ---- batting ----

    private CricClubsScorecardMapper.Row battingRow(Line line) {
        List<String> cells = line.cells();
        if (cells.size() != BATTING_HEADER.size()) {
            error(line, "BAD_ROW", "A batting row has " + BATTING_HEADER.size() + " columns (name, how out, fielder, bowler,"
                    + " runs, balls, fours, sixes) but this one has " + cells.size() + ".");
            return null;
        }
        if (cells.get(0).isEmpty()) {
            error(line, "BAD_ROW", "The batter's name is empty.");
            return null;
        }
        CricClubsScorecardMapper.RowOutcome outcome = CricClubsScorecardMapper.batter(cells.get(0), cells.get(1),
                blankToNull(cells.get(2)), blankToNull(cells.get(3)), parseWhole(line, cells.get(4), "Runs"),
                parseWhole(line, cells.get(5), "Balls"), parseWhole(line, cells.get(6), "Fours"),
                parseWhole(line, cells.get(7), "Sixers"));
        if (outcome.problem() != null) {
            error(line, outcome.problem().code(), outcome.problem().message());
        }
        return outcome.row();
    }

    /** The innings' batting block from the title: header row, batters, then the extras and total line that closes it. */
    private int readBatting(int titleIndex, InningsParts innings) {
        int i = expectHeader(titleIndex + 1, BATTING_HEADER, "batting");
        List<CricClubsScorecardMapper.Row> rows = new ArrayList<>();
        while (i < lines.size()) {
            Line line = lines.get(i);
            i++;
            if (line.isBlank()) {
                continue;
            }
            if (line.text().startsWith("Byes")) {
                readExtras(line, innings);
                CricClubsScorecardMapper.Decided decided = CricClubsScorecardMapper.decideRetired(rows, innings.wickets);
                if (decided.problem() != null) {
                    error(line, decided.problem().code(), decided.problem().message());
                } else {
                    innings.batting.addAll(decided.batting());
                    innings.didNotBat.addAll(decided.didNotBat());
                }
                return i;
            }
            if (TITLE.matcher(line.text()).matches() || FALL_OF_WICKETS.matcher(line.text()).matches()) {
                throw fail(CricClubsLines.path(line.number()), "MISSING_SECTION",
                        "The batting section ends without its extras and total line, which starts 'Byes:'.");
            }
            CricClubsScorecardMapper.Row row = battingRow(line);
            if (row != null) {
                rows.add(row);
            }
        }
        throw fail(CricClubsLines.path(lines.size()), "MISSING_SECTION",
                "The file ends inside the batting section for " + name(innings.battingKey)
                        + ", before its extras and total line, which starts 'Byes:'.");
    }

    private void readExtras(Line line, InningsParts innings) {
        Matcher match = EXTRAS.matcher(line.text());
        if (!match.matches()) {
            throw fail(CricClubsLines.path(line.number()), "EXTRAS_LINE_NOT_UNDERSTOOD",
                    "The extras and total line should look like 'Byes: 1 , Leg Byes: 3, Wickets : 9  Wides : 12,"
                            + " No Balls: 1 Penalty : 0,78,19'.");
        }
        String overs = match.group(8);
        OversFormat.Parsed parsed = OversFormat.parse(overs, 6);
        if (!parsed.valid()) {
            error(line, "BAD_OVERS", "The innings overs '" + overs + "' are not valid. " + parsed.error());
        }
        innings.extras = new Extras(whole(match, 4), whole(match, 5), whole(match, 1), whole(match, 2), whole(match, 6));
        innings.wickets = whole(match, 3);
        innings.runs = whole(match, 7);
        innings.overs = overs;
    }

    // ---- bowling ----

    private int readBowling(int titleIndex, InningsParts innings) {
        int i = expectHeader(titleIndex + 1, BOWLING_HEADER, "bowling");
        while (i < lines.size()) {
            Line line = lines.get(i);
            i++;
            if (line.isBlank()) {
                continue;
            }
            if (TITLE.matcher(line.text()).matches() || FALL_OF_WICKETS.matcher(line.text()).matches()) {
                throw fail(CricClubsLines.path(line.number()), "MISSING_SECTION",
                        "The bowling section ends without its 'Total' line.");
            }
            List<String> cells = line.cells();
            if (cells.get(0).equalsIgnoreCase("Total")) {
                return i;
            }
            if (cells.size() != BOWLING_HEADER.size()) {
                error(line, "BAD_ROW", "A bowling row has " + BOWLING_HEADER.size() + " columns (name, overs, maidens, runs,"
                        + " wickets, wides, no balls, hat-tricks, dot balls) but this one has " + cells.size() + ".");
                continue;
            }
            if (cells.get(0).isEmpty()) {
                error(line, "BAD_ROW", "The bowler's name is empty.");
                continue;
            }
            String overs = cells.get(1);
            OversFormat.Parsed parsed = OversFormat.parse(overs, 6);
            if (!parsed.valid()) {
                error(line, "BAD_OVERS", "The overs '" + overs + "' are not valid. " + parsed.error());
            }
            innings.bowling.add(new Bowling(cells.get(0), overs, parseWhole(line, cells.get(2), "Madiens"),
                    parseWhole(line, cells.get(3), "Runs"), parseWhole(line, cells.get(4), "Wickets"),
                    parseWhole(line, cells.get(5), "Wides"), parseWhole(line, cells.get(6), "No Balls"),
                    parseWhole(line, cells.get(8), "Dot Balls")));
            parseWhole(line, cells.get(7), "Hattricks");
        }
        throw fail(CricClubsLines.path(lines.size()), "MISSING_SECTION",
                "The file ends inside the bowling section, before its 'Total' line.");
    }

    // ---- helpers ----

    /** Finds the column header row after a title (blank lines allowed) and checks it names the expected columns. */
    private int expectHeader(int from, List<String> expected, String section) {
        int index = nextNonBlank(from);
        if (index < 0) {
            throw fail(CricClubsLines.path(lines.size()), "MISSING_SECTION",
                    "The file ends after a " + section + " title, before its column header row.");
        }
        Line line = lines.get(index);
        List<String> cells = line.cells().stream().map(c -> c.toLowerCase(Locale.ROOT)).toList();
        if (!cells.equals(expected)) {
            throw fail(CricClubsLines.path(line.number()), "UNKNOWN_LAYOUT",
                    "Expected the " + section + " column header row ('" + String.join(", ", expected)
                            + "'). This layout is not one this adaptor knows.");
        }
        return index + 1;
    }

    private int parseWhole(Line line, String cell, String what) {
        if (!WHOLE_NUMBER.matcher(cell).matches()) {
            error(line, "BAD_NUMBER", "'" + cell + "' is not a whole number, but " + what + " must be.");
            return 0;
        }
        return Integer.parseInt(cell);
    }

    private static int whole(Matcher match, int group) {
        return Integer.parseInt(match.group(group));
    }

    private int nextNonBlank(int from) {
        for (int i = from; i < lines.size(); i++) {
            if (!lines.get(i).isBlank()) {
                return i;
            }
        }
        return -1;
    }

    private void error(Line line, String code, String message) {
        errors.add(new ImportErrorDto(CricClubsLines.path(line.number()), code, message));
    }

    private ImportInputValidationException fail(String path, String code, String message) {
        errors.add(new ImportErrorDto(path, code, message));
        return new ImportInputValidationException(REJECTED, errors);
    }

    private String name(String key) {
        return "'" + ("A".equals(key) ? teamAName : teamBName) + "'";
    }

    private static String blankToNull(String text) {
        return text.isEmpty() ? null : text;
    }
}
