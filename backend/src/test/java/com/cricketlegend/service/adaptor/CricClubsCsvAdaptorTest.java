package com.cricketlegend.service.adaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.dto.ImportErrorDto;
import com.cricketlegend.dto.ImportedResultDto;
import com.cricketlegend.dto.ImportedResultDto.Batting;
import com.cricketlegend.exception.ImportInputValidationException;
import com.cricketlegend.exception.UnsupportedImportFormatException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * docs/specs/107-match-results-cricclubs-csv-adaptor.md Test Plan, "Adaptor unit tests": the result line in each form, the
 * dismissal codes, the retired-batter rule, the encodings and line endings, the quoting, and every failure with its line
 * number and message. Reports are built from one small template of invented names whose line numbers are fixed (see
 * {@link #report}), so each failure test can name the line it expects.
 */
class CricClubsCsvAdaptorTest {

    private static final String HEAD = "T20:  LeagueHillside 4 won by 10 Runs (11/10/2026)";
    private static final String TEAMS = "                     Hillside 4 Vs Valley Rovers";
    private static final String BATTING_HEADER = "\tBatsMan, How Out, Fielder, Bowler, Runs, Balls, Fours,Sixers";
    private static final String BOWLING_HEADER = "\tBowler,Overs,Madiens,Runs,Wickets,Wides,No Balls,Hattricks,Dot Balls";
    private static final String FIRST_ROW = "\tAnn Alder,b,,Kay Kauri,5,10,0,0";

    private final CricClubsCsvAdaptor adaptor = new CricClubsCsvAdaptor();

    /**
     * A two innings report. Line 1 the result, 2 the teams, 3 the first batting title, 4 its header, 5 to 7 three batters
     * (the first is {@link #FIRST_ROW}), 8 the extras line (1 wicket stated), 9 the bowling title, 10 its header, 11 a
     * bowler, 12 the total, 13 and 14 the fall of wickets, 15 the second batting title, 16 its header, 17 one batter,
     * 18 its extras line, 19 the bowling title, 20 its header, 21 a bowler, 22 the total, 23 and 24 the fall of
     * wickets.
     */
    private static String report(String head, String teams) {
        return String.join("\n", head, teams,
                ",,,Hillside 4 Batting",
                BATTING_HEADER,
                FIRST_ROW,
                "Bob Birch,,,,9,8,1,0",
                "Cat Cedar,,,,0,0,0,0",
                "\t\tByes: 1 , Leg Byes: 2, Wickets : 1  Wides : 3, No Balls: 4 Penalty : 5,60,10.3",
                ",,,Valley Rovers Bowling ",
                BOWLING_HEADER,
                "\tKay Kauri,4,1,30,2,3,4,0,10",
                "Total, 4 ,1,30,2,3,4,0,10",
                "Hillside 4 Fall of Wickets",
                "Pat X, 1-10 ,  Over 2.1",
                ",,,Valley Rovers Batting",
                BATTING_HEADER,
                "\tDale Pine,b,,Kay K,49,49,6,1",
                "Byes: 1 , Leg Byes: 1, Wickets : 1  Wides : 11, No Balls: 1 Penalty : 0,121,15.5",
                ",,,Hillside 4 Bowling",
                BOWLING_HEADER,
                "\tAnn Alder,4,0,16,0,0,0,0,13",
                "Total, 4 ,0,16,0,0,0,0,13",
                "Valley Rovers Fall of wickets",
                "Dale P, 1-109 ,  Over14.4",
                "");
    }

    private static String report() {
        return report(HEAD, TEAMS);
    }

    /** The text with the given 1-based line replaced. */
    private static String withLine(String text, int number, String replacement) {
        String[] lines = text.split("\n", -1);
        lines[number - 1] = replacement;
        return String.join("\n", lines);
    }

    private static String withoutLines(String text, int from, int to) {
        String[] lines = text.split("\n", -1);
        return String.join("\n", Arrays.asList(lines).subList(0, from - 1))
                + "\n" + String.join("\n", Arrays.asList(lines).subList(to, lines.length));
    }

    private ImportedResultDto read(String text) {
        return adaptor.importFrom(ImportInput.paste(ImportInputFormat.CSV, text));
    }

    private ImportedResultDto readBytes(byte[] bytes) {
        return adaptor.importFrom(ImportInput.file(ImportInputFormat.CSV, "report.csv", bytes));
    }

    private List<ImportErrorDto> errorsOf(String text) {
        ImportInputValidationException thrown = invalid(text);
        return thrown.getErrors();
    }

    private ImportInputValidationException invalid(String text) {
        return invalid(() -> read(text));
    }

    private static ImportInputValidationException invalid(Runnable run) {
        try {
            run.run();
        } catch (ImportInputValidationException ex) {
            return ex;
        }
        throw new AssertionError("expected an ImportInputValidationException");
    }

    private void assertSingleError(String text, String path, String code, String messagePart) {
        List<ImportErrorDto> errors = errorsOf(text);
        assertThat(errors).hasSize(1);
        assertThat(errors.get(0).path()).isEqualTo(path);
        assertThat(errors.get(0).code()).isEqualTo(code);
        assertThat(errors.get(0).message()).contains(messagePart);
    }

    /** The first batter of the first innings when line 5 is replaced by the row (and the wickets stated are 1). */
    private Batting firstBatter(String row) {
        return read(withLine(report(), 5, row)).innings().get(0).batting().get(0);
    }

    // ---- the descriptor ----

    @Test
    void theAdaptorDescribesItselfAsATextCsvSourceWithNoAiAndNoPrompt() {
        assertThat(adaptor.getType()).isEqualTo(AdaptorType.CRICCLUBS_CSV);
        assertThat(adaptor.getDisplayName()).isEqualTo("CricClubs scorecard (CSV)");
        assertThat(adaptor.getSupportedFormats()).containsExactly(ImportInputFormat.CSV);
        assertThat(adaptor.isAiAllowed()).isFalse();
        assertThat(adaptor.getConversionPrompt()).isNull();
        assertThat(adaptor.getExample()).isNotBlank();
    }

    @Test
    void theExampleIsAReportTheAdaptorReadsItself() {
        ImportedResultDto result = read(adaptor.getExample());

        assertThat(result.result().outcome()).isEqualTo(ResultOutcomeType.WON);
        assertThat(result.innings()).hasSize(1);
    }

    @Test
    void anotherFormatIsRefused() {
        assertThatThrownBy(() -> adaptor.importFrom(ImportInput.paste(ImportInputFormat.JSON, "{}")))
                .isInstanceOf(UnsupportedImportFormatException.class);
    }

    // ---- the result line and the teams line ----

    @Test
    void aWinByRunsGivesTheWinnerAndTheMarginInRuns() {
        ImportedResultDto result = read(report());

        assertThat(result.result().outcome()).isEqualTo(ResultOutcomeType.WON);
        assertThat(result.result().winner()).isEqualTo("A");
        assertThat(result.result().margin().type()).isEqualTo(ResultMarginType.RUNS);
        assertThat(result.result().margin().value()).isEqualTo(10);
        assertThat(result.teams()).extracting(ImportedResultDto.Team::key).containsExactly("A", "B");
        assertThat(result.teams()).extracting(ImportedResultDto.Team::name).containsExactly("Hillside 4", "Valley Rovers");
    }

    @Test
    void aWinByWicketsGivesTheWinnerAndTheMarginInWickets() {
        ImportedResultDto result = read(report("T20:  LeagueValley Rovers won by 8 Wickets (11/10/2026)", TEAMS));

        assertThat(result.result().outcome()).isEqualTo(ResultOutcomeType.WON);
        assertThat(result.result().winner()).isEqualTo("B");
        assertThat(result.result().margin().type()).isEqualTo(ResultMarginType.WICKETS);
        assertThat(result.result().margin().value()).isEqualTo(8);
    }

    @Test
    void aTieHasNoWinnerAndNoMargin() {
        ImportedResultDto result = read(report("T20:  LeagueIt is a Tie (04/10/2026)", TEAMS));

        assertThat(result.result().outcome()).isEqualTo(ResultOutcomeType.TIE);
        assertThat(result.result().winner()).isNull();
        assertThat(result.result().margin()).isNull();
        assertThat(result.match().date()).isEqualTo(LocalDate.of(2026, 10, 4));
    }

    @Test
    void aForfeitNamesTheWinnerAndHasNoInnings() {
        ImportedResultDto result = read(report("T20:  LeagueForfeited. Winner: Valley Rovers (13/09/2026)", TEAMS));

        assertThat(result.result().outcome()).isEqualTo(ResultOutcomeType.FORFEIT);
        assertThat(result.result().winner()).isEqualTo("B");
        assertThat(result.result().margin()).isNull();
        assertThat(result.innings()).isEmpty();
    }

    @Test
    void theDateIsDayMonthYearAndThereIsNoTimeOrVenue() {
        ImportedResultDto result = read(report());

        assertThat(result.match().date()).isEqualTo(LocalDate.of(2026, 10, 11));
        assertThat(result.match().startTime()).isNull();
        assertThat(result.match().venue()).isNull();
        assertThat(result.toss()).isNull();
        assertThat(result.awards()).isNull();
    }

    @Test
    void t20IsTwentyOversAndThereIsNoCompetitionWhenNoWordsFollowTheFormat() {
        ImportedResultDto result = read(report());

        assertThat(result.result().scheduledOvers()).isEqualTo(20);
        assertThat(result.match().competition()).isNull();
    }

    @Test
    void fiftyOverFormatIsReadAndTheWordsAfterItAreTheCompetitionAsWritten() {
        ImportedResultDto result = read(report("O/50 IPT:  PracticeHillside 4 won by 84 Runs (22/11/2025)", TEAMS));

        assertThat(result.result().scheduledOvers()).isEqualTo(50);
        assertThat(result.match().competition()).isEqualTo("IPT");
        assertThat(result.match().date()).isEqualTo(LocalDate.of(2025, 11, 22));
    }

    @Test
    void anyOtherOverFormatIsReadTheSameWay() {
        assertThat(read(report("O/40:  LeagueHillside 4 won by 4 Runs (22/11/2025)", TEAMS)).result().scheduledOvers())
                .isEqualTo(40);
    }

    @Test
    void anUnknownFormatWordLeavesTheScheduledOversEmpty() {
        assertThat(read(report("ODI:  LeagueHillside 4 won by 4 Runs (22/11/2025)", TEAMS)).result().scheduledOvers())
                .isNull();
    }

    @Test
    void theMatchTypeGluedToTheTeamNameDoesNotHideTheWinner() {
        // "League" and "Practice" are glued to the team name with no space; the team name is matched at the end
        assertThat(read(report("T20:  PracticeHillside 4 won by 4 Runs (22/11/2025)", TEAMS)).result().winner())
                .isEqualTo("A");
        assertThat(read(report("T20:  LeagueValley Rovers won by 4 Runs (22/11/2025)", TEAMS)).result().winner())
                .isEqualTo("B");
    }

    @Test
    void whenOneTeamNameEndsTheOtherTheLongerNameWins() {
        assertThat(read(stars("XI Stars")).result().winner()).isEqualTo("B");
        assertThat(read(stars("Stars")).result().winner()).isEqualTo("A");
    }

    /** The report with the teams renamed to "Stars" and "XI Stars" and the given winner in the result line. */
    private static String stars(String winner) {
        return report("T20:  League" + winner + " won by 4 Runs (22/11/2025)", "                     Stars Vs XI Stars")
                .replace("Hillside 4", "Stars").replace("Valley Rovers", "XI Stars");
    }

    @Test
    void theSourceCarriesTheCricClubsProviderAndNoMatchId() {
        ImportedResultDto result = readBytes(report().getBytes(StandardCharsets.UTF_8));

        assertThat(result.source().adaptor()).isEqualTo(AdaptorType.CRICCLUBS_CSV);
        assertThat(result.source().provider()).isEqualTo("CRICCLUBS");
        assertThat(result.source().externalMatchId()).isNull();
        assertThat(result.source().fileName()).isEqualTo("report.csv");
        assertThat(result.schemaVersion()).isEqualTo(1);
    }

    // ---- the innings ----

    @Test
    void theInningsOrderComesFromTheOrderOfTheBattingBlocksNotTheTeamsLine() {
        ImportedResultDto result = read(report());

        assertThat(result.innings()).extracting(ImportedResultDto.Innings::battingTeam).containsExactly("A", "B");
        assertThat(result.innings()).extracting(ImportedResultDto.Innings::kind)
                .containsOnly(InningsKind.REGULAR);
    }

    @Test
    void theInningsRunsAndOversComeFromTheExtrasLineNotTheBowlingTotal() {
        ImportedResultDto.Innings first = read(report()).innings().get(0);

        assertThat(first.runs()).isEqualTo(60);
        assertThat(first.overs()).isEqualTo("10.3");
        assertThat(first.wickets()).isEqualTo(1);
    }

    @Test
    void theExtrasLineGivesWidesNoBallsByesLegByesAndPenalty() {
        ImportedResultDto.Extras extras = read(report()).innings().get(0).extras();

        assertThat(extras.byes()).isEqualTo(1);
        assertThat(extras.legByes()).isEqualTo(2);
        assertThat(extras.wides()).isEqualTo(3);
        assertThat(extras.noBalls()).isEqualTo(4);
        assertThat(extras.penalty()).isEqualTo(5);
    }

    @Test
    void theBowlingTableIsReadAndTheHatTricksColumnIsIgnored() {
        ImportedResultDto.Bowling bowler = read(report()).innings().get(0).bowling().get(0);

        assertThat(bowler.player()).isEqualTo("Kay Kauri");
        assertThat(bowler.overs()).isEqualTo("4");
        assertThat(bowler.maidens()).isEqualTo(1);
        assertThat(bowler.runs()).isEqualTo(30);
        assertThat(bowler.wickets()).isEqualTo(2);
        assertThat(bowler.wides()).isEqualTo(3);
        assertThat(bowler.noBalls()).isEqualTo(4);
        assertThat(bowler.dots()).isEqualTo(10);
        assertThat(read(report()).innings().get(0).bowling()).hasSize(1);
    }

    @Test
    void theBowlingBlockBelongsToTheTeamThatDidNotBatInTheBlockBeforeIt() {
        ImportedResultDto result = read(report());

        assertThat(result.innings().get(1).bowling()).extracting(ImportedResultDto.Bowling::player)
                .containsExactly("Ann Alder");
    }

    @Test
    void theFallOfWicketsIsReadOnlyToBeIgnored() {
        // an unreadable fall of wickets line changes nothing
        ImportedResultDto result = read(withLine(report(), 14, "garbage ,, with ,,, commas 1-10Retired"));

        assertThat(result.innings()).hasSize(2);
    }

    @Test
    void aReportWithoutAnyFallOfWicketsIsRead() {
        String text = withoutLines(withoutLines(report(), 23, 24), 13, 14);

        assertThat(read(text).innings()).hasSize(2);
    }

    @Test
    void aReportWithOnlyOneInningsIsRead() {
        String text = withoutLines(report(), 15, 23);

        assertThat(read(text).innings()).hasSize(1);
    }

    // ---- batting rows and dismissal codes ----

    @ParameterizedTest
    @CsvSource({
        "'b', BOWLED",
        "'lbw', LBW"
    })
    void bowledAndLbwKeepTheBowler(String code, DismissalType expected) {
        Batting row = firstBatter("\tAnn Alder," + code + ",,Kay Kauri,5,10,0,0");

        assertThat(row.howOut()).isEqualTo(expected);
        assertThat(row.bowler()).isEqualTo("Kay Kauri");
        assertThat(row.fielder()).isNull();
        assertThat(row.runs()).isEqualTo(5);
        assertThat(row.balls()).isEqualTo(10);
    }

    @Test
    void aCatchKeepsTheFielderAndTheBowler() {
        Batting row = firstBatter("\tAnn Alder,ct,Fay Field,Kay Kauri,5,10,0,0");

        assertThat(row.howOut()).isEqualTo(DismissalType.CAUGHT);
        assertThat(row.fielder()).isEqualTo("Fay Field");
        assertThat(row.bowler()).isEqualTo("Kay Kauri");
    }

    @Test
    void aCatchByTheBowlerIsCaughtAndBowledWithNoFielder() {
        Batting row = firstBatter("\tAnn Alder,ct,Kay K,Kay K,5,10,0,0");

        assertThat(row.howOut()).isEqualTo(DismissalType.CAUGHT_AND_BOWLED);
        assertThat(row.fielder()).isNull();
        assertThat(row.bowler()).isEqualTo("Kay K");
    }

    @Test
    void aCatchByTheWicketkeeperIsACatchWithTheKeeperAsFielder() {
        Batting row = firstBatter("\tAnn Alder,ctw,Gus Glove,Kay Kauri,5,10,0,0");

        assertThat(row.howOut()).isEqualTo(DismissalType.CAUGHT);
        assertThat(row.fielder()).isEqualTo("Gus Glove");
        assertThat(row.bowler()).isEqualTo("Kay Kauri");
    }

    @Test
    void aStumpingKeepsTheKeeperAndTheBowler() {
        Batting row = firstBatter("\tAnn Alder,st,Gus Glove,Kay Kauri,5,10,0,0");

        assertThat(row.howOut()).isEqualTo(DismissalType.STUMPED);
        assertThat(row.fielder()).isEqualTo("Gus Glove");
        assertThat(row.bowler()).isEqualTo("Kay Kauri");
    }

    @Test
    void aRunOutKeepsTheFielderAndDropsTheStrayBowler() {
        Batting row = firstBatter("\tAnn Alder,ro,Fay Field,Kay Kauri,5,10,0,0");

        assertThat(row.howOut()).isEqualTo(DismissalType.RUN_OUT);
        assertThat(row.fielder()).isEqualTo("Fay Field");
        assertThat(row.bowler()).isNull();
    }

    @Test
    void aRunOutWithNoFielderIsStillARunOut() {
        Batting row = firstBatter("\tAnn Alder,ro,,Kay Kauri,5,10,0,0");

        assertThat(row.howOut()).isEqualTo(DismissalType.RUN_OUT);
        assertThat(row.fielder()).isNull();
        assertThat(row.bowler()).isNull();
    }

    @Test
    void aSubstituteFielderKeepsTheCatchButLeavesTheFielderEmpty() {
        Batting row = firstBatter("\tAnn Alder,ct,Substitute,Kay Kauri,5,10,0,0");

        assertThat(row.howOut()).isEqualTo(DismissalType.CAUGHT);
        assertThat(row.fielder()).isNull();
        assertThat(row.bowler()).isEqualTo("Kay Kauri");
    }

    @Test
    void aSubstituteFielderOnARunOutLeavesTheFielderEmpty() {
        Batting row = firstBatter("\tAnn Alder,ro,Substitute,,5,10,0,0");

        assertThat(row.howOut()).isEqualTo(DismissalType.RUN_OUT);
        assertThat(row.fielder()).isNull();
    }

    @Test
    void aBlankCodeWithBallsFacedOrRunsIsNotOut() {
        ImportedResultDto.Innings first = read(report()).innings().get(0);

        assertThat(first.batting()).extracting(Batting::player).containsExactly("Ann Alder", "Bob Birch");
        assertThat(first.batting().get(1).howOut()).isEqualTo(DismissalType.NOT_OUT);
        assertThat(first.batting().get(1).bowler()).isNull();
        assertThat(first.batting().get(1).runs()).isEqualTo(9);
        assertThat(first.batting().get(1).fours()).isEqualTo(1);
    }

    @Test
    void aBlankCodeWithNoBallsAndNoRunsDidNotBat() {
        ImportedResultDto.Innings first = read(report()).innings().get(0);

        assertThat(first.didNotBat()).containsExactly("Cat Cedar");
        assertThat(first.batting()).extracting(Batting::player).doesNotContain("Cat Cedar");
    }

    @Test
    void aBlankCodeWithRunsButNoBallsIsNotOut() {
        ImportedResultDto.Innings first = read(withLine(report(), 7, "Cat Cedar,,,,4,0,0,0")).innings().get(0);

        assertThat(first.batting()).extracting(Batting::player).contains("Cat Cedar");
        assertThat(first.didNotBat()).isEmpty();
    }

    @Test
    void theCodeIsReadWhateverItsCase() {
        assertThat(firstBatter("\tAnn Alder,LBW,,Kay Kauri,5,10,0,0").howOut()).isEqualTo(DismissalType.LBW);
    }

    @Test
    void namesAreKeptAsWrittenWithTheSpacesAndTabsAroundThemTrimmed() {
        Batting row = firstBatter("\t  Ann   Alder \t,b, ,  Kay K  ,5,10,0,0");

        assertThat(row.player()).isEqualTo("Ann   Alder");
        assertThat(row.bowler()).isEqualTo("Kay K");
    }

    @Test
    void aQuotedNameMayContainAComma() {
        Batting row = firstBatter("\t\"Alder, Ann\",b,,\"Kauri, Kay\",5,10,0,0");

        assertThat(row.player()).isEqualTo("Alder, Ann");
        assertThat(row.bowler()).isEqualTo("Kauri, Kay");
    }

    // ---- retired batters ----

    private static String retiredReport(int statedWickets) {
        String text = withLine(report(), 6, "Bob Birch,rt,,,40,30,4,1");
        return withLine(text, 8, "\t\tByes: 1 , Leg Byes: 2, Wickets : " + statedWickets
                + "  Wides : 3, No Balls: 4 Penalty : 5,60,10.3");
    }

    @ParameterizedTest
    @CsvSource({"rt", "rtno"})
    void retiredBattersAreNotOutWhenTheStatedWicketsEqualTheDismissals(String code) {
        String text = withLine(retiredReport(1), 6, "Bob Birch," + code + ",,,40,30,4,1");

        Batting retired = read(text).innings().get(0).batting().get(1);

        assertThat(retired.howOut()).isEqualTo(DismissalType.RETIRED_NOT_OUT);
        assertThat(retired.bowler()).isNull();
        assertThat(retired.fielder()).isNull();
        assertThat(retired.runs()).isEqualTo(40);
    }

    @Test
    void retiredBattersAreOutWhenTheStatedWicketsAlsoCountTheRetirements() {
        Batting retired = read(retiredReport(2)).innings().get(0).batting().get(1);

        assertThat(retired.howOut()).isEqualTo(DismissalType.RETIRED_OUT);
    }

    @Test
    void retiredBattersFailWithTheExtrasLineWhenNeitherReadingFits() {
        List<ImportErrorDto> errors = errorsOf(retiredReport(5));

        assertThat(errors).hasSize(1);
        assertThat(errors.get(0).path()).isEqualTo("line 8");
        assertThat(errors.get(0).code()).isEqualTo("WICKETS_DO_NOT_MATCH_BATTERS");
        assertThat(errors.get(0).message()).contains("5 wickets", "1 dismissals", "1 retired");
    }

    @Test
    void aReportWithNoRetiredBattersIsNotCheckedAgainstTheStatedWickets() {
        // wickets against dismissals is the existing validator's warning, not the adaptor's
        String text = withLine(report(), 8, "\t\tByes: 1 , Leg Byes: 2, Wickets : 7  Wides : 3, No Balls: 4 Penalty : 5,60,10.3");

        assertThat(read(text).innings().get(0).wickets()).isEqualTo(7);
    }

    // ---- encodings, line endings, paste ----

    @Test
    void windowsLineEndingsAreTolerated() {
        ImportedResultDto result = read(report().replace("\n", "\r\n"));

        assertThat(result.innings()).hasSize(2);
        assertThat(result.innings().get(0).batting().get(0).bowler()).isEqualTo("Kay Kauri");
    }

    @Test
    void aByteOrderMarkIsTolerated() {
        byte[] body = report().getBytes(StandardCharsets.UTF_8);
        byte[] bytes = new byte[body.length + 3];
        bytes[0] = (byte) 0xEF;
        bytes[1] = (byte) 0xBB;
        bytes[2] = (byte) 0xBF;
        System.arraycopy(body, 0, bytes, 3, body.length);

        assertThat(readBytes(bytes).teams().get(0).name()).isEqualTo("Hillside 4");
    }

    @Test
    void aByteOrderMarkInPastedTextIsTolerated() {
        assertThat(read("﻿" + report()).teams().get(0).name()).isEqualTo("Hillside 4");
    }

    @Test
    void aUtf8FileKeepsItsAccentedName() {
        String text = withLine(report(), 5, "\tMoré Maple,b,,Kay Kauri,5,10,0,0");

        assertThat(readBytes(text.getBytes(StandardCharsets.UTF_8)).innings().get(0).batting().get(0).player())
                .isEqualTo("Moré Maple");
    }

    @Test
    void aWindows1252FileIsReadWithItsAccentedNameInsteadOfBeingRefused() {
        String text = withLine(report(), 5, "\tMoré Maple,b,,Kay Kauri,5,10,0,0");
        byte[] bytes = text.getBytes(Charset.forName("windows-1252"));

        assertThat(readBytes(bytes).innings().get(0).batting().get(0).player()).isEqualTo("Moré Maple");
    }

    @Test
    void pastedTextIsReadAsItIs() {
        ImportedResultDto result = read(report());

        assertThat(result.source().fileName()).isNull();
        assertThat(result.innings()).hasSize(2);
    }

    // ---- failures, each with its line number and message ----

    @Test
    void anUnknownDismissalCodeFailsWithItsLineAndTheCode() {
        assertSingleError(withLine(report(), 5, "\tAnn Alder,rtd,,Kay Kauri,5,10,0,0"),
                "line 5", "UNKNOWN_DISMISSAL", "Unknown dismissal code 'rtd'");
    }

    @Test
    void aNumberThatIsNotANumberFailsWithItsLineAndColumn() {
        assertSingleError(withLine(report(), 6, "Bob Birch,,,,nine,8,1,0"),
                "line 6", "BAD_NUMBER", "'nine' is not a whole number, but Runs must be");
    }

    @Test
    void aTrailingWordOnANumberFails() {
        assertSingleError(withLine(report(), 6, "Bob Birch,,,,9,8,1,0No"),
                "line 6", "BAD_NUMBER", "'0No' is not a whole number, but Sixers must be");
    }

    @Test
    void aBadBowlingNumberFailsWithItsLine() {
        assertSingleError(withLine(report(), 11, "\tKay Kauri,4,1,x,2,3,4,0,10"),
                "line 11", "BAD_NUMBER", "'x' is not a whole number, but Runs must be");
    }

    @Test
    void aBadOversValueFailsWithItsLine() {
        assertSingleError(withLine(report(), 11, "\tKay Kauri,4.9,1,30,2,3,4,0,10"),
                "line 11", "BAD_OVERS", "'4.9'");
    }

    @Test
    void severalRowProblemsAreReportedTogether() {
        List<ImportErrorDto> errors = errorsOf(withLine(withLine(report(), 5, "\tAnn Alder,zz,,Kay Kauri,5,10,0,0"),
                6, "Bob Birch,,,,nine,8,1,0"));

        assertThat(errors).extracting(ImportErrorDto::path).containsExactly("line 5", "line 6");
    }

    @Test
    void aBatterRowWithTheWrongNumberOfColumnsFails() {
        assertSingleError(withLine(report(), 6, "Bob Birch,,,,9,8"), "line 6", "BAD_ROW", "has 6");
    }

    @Test
    void aCatchWithNeitherFielderNorBowlerFails() {
        assertSingleError(withLine(report(), 5, "\tAnn Alder,ct,Substitute,,5,10,0,0"),
                "line 5", "FIELDER_OR_BOWLER_REQUIRED", "needs a fielder or a bowler");
    }

    @Test
    void aFielderOnABowledDismissalFails() {
        assertSingleError(withLine(report(), 5, "\tAnn Alder,b,Fay Field,Kay Kauri,5,10,0,0"),
                "line 5", "UNEXPECTED_NAME", "A fielder cannot be named for 'b'");
    }

    @Test
    void aRetiredBatterThatNamesABowlerFails() {
        assertSingleError(withLine(report(), 5, "\tAnn Alder,rt,,Kay Kauri,5,10,0,0"),
                "line 5", "UNEXPECTED_NAME", "retired batter");
    }

    @Test
    void aBadDateFailsOnTheFirstLine() {
        assertSingleError(report("T20:  LeagueHillside 4 won by 10 Runs (31/02/2026)", TEAMS),
                "line 1", "INVALID_DATE", "'31/02/2026' is not a date");
    }

    @Test
    void aResultLineWithNoDateIsNotUnderstood() {
        assertSingleError(report("T20:  LeagueHillside 4 won by 10 Runs", TEAMS),
                "line 1", "RESULT_LINE_NOT_UNDERSTOOD", "not a CricClubs scorecard export");
    }

    @Test
    void aResultTextThatIsNotOneOfTheFourFormsFails() {
        assertSingleError(report("T20:  LeagueNo result (11/10/2026)", TEAMS),
                "line 1", "RESULT_NOT_UNDERSTOOD", "'LeagueNo result'");
    }

    @Test
    void aWinnerThatIsNeitherTeamFails() {
        assertSingleError(report("T20:  LeagueDowntown 9 won by 10 Runs (11/10/2026)", TEAMS),
                "line 1", "WINNER_NOT_FOUND", "does not end with either team name");
    }

    @Test
    void aForfeitWinnerThatIsNeitherTeamFails() {
        assertSingleError(report("T20:  LeagueForfeited. Winner: Downtown 9 (11/10/2026)", TEAMS),
                "line 1", "WINNER_NOT_FOUND", "'Downtown 9'");
    }

    @Test
    void aTeamsLineWithoutVsFails() {
        assertSingleError(report(HEAD, "                     Hillside 4 and Valley Rovers"),
                "line 2", "TEAMS_LINE_NOT_UNDERSTOOD", "two teams");
    }

    @Test
    void aMissingTeamsLineFails() {
        assertSingleError(HEAD + "\n", "line 1", "TEAMS_LINE_MISSING", "missing");
    }

    @Test
    void aBattingSectionForATeamThatIsNotInTheMatchFails() {
        assertSingleError(withLine(report(), 3, ",,,Downtown 9 Batting"),
                "line 3", "UNKNOWN_TEAM", "'Downtown 9'");
    }

    @Test
    void aBowlingSectionForTheSideThatBattedFails() {
        assertSingleError(withLine(report(), 9, ",,,Hillside 4 Bowling"),
                "line 9", "SECTION_OUT_OF_PLACE", "should be the other team");
    }

    @Test
    void aMissingBowlingSectionIsReportedAtItsBattingTitle() {
        assertSingleError(withoutLines(report(), 9, 14), "line 3", "MISSING_SECTION", "no bowling section");
    }

    @Test
    void aMissingBattingSectionFails() {
        assertSingleError(String.join("\n", HEAD, TEAMS, ""), "", "MISSING_SECTION", "no batting section");
    }

    @Test
    void aBowlingSectionBeforeAnyBattingSectionFails() {
        assertSingleError(String.join("\n", HEAD, TEAMS, ",,,Valley Rovers Bowling", BOWLING_HEADER, "Total, 0 ,0,0,0,0,0,0,0"),
                "line 3", "SECTION_OUT_OF_PLACE", "does not follow a batting section");
    }

    @Test
    void aMissingExtrasLineIsReportedWhereTheNextSectionStarts() {
        assertSingleError(withoutLines(report(), 8, 8), "line 8", "MISSING_SECTION", "extras and total line");
    }

    @Test
    void aMissingBowlingTotalIsReportedWhereTheNextSectionStarts() {
        assertSingleError(withoutLines(report(), 12, 12), "line 12", "MISSING_SECTION", "'Total' line");
    }

    @Test
    void aReorderedBlockWithAWrongHeaderIsReportedNotMisread() {
        assertSingleError(withLine(report(), 4, BOWLING_HEADER), "line 4", "UNKNOWN_LAYOUT", "batting column header");
    }

    @Test
    void aBattingHeaderWithDifferentColumnsFails() {
        assertSingleError(withLine(report(), 4, "\tBatsMan, How Out, Fielder, Bowler, Runs, Balls"),
                "line 4", "UNKNOWN_LAYOUT", "This layout is not one this adaptor knows");
    }

    @Test
    void anExtrasLineInAnotherShapeFails() {
        assertSingleError(withLine(report(), 8, "\t\tByes: 1 , Wickets : 1,60,10.3"),
                "line 8", "EXTRAS_LINE_NOT_UNDERSTOOD", "extras and total line should look like");
    }

    @Test
    void aTotalOversThatIsNotAValidOversFails() {
        assertSingleError(withLine(report(), 8,
                        "\t\tByes: 1 , Leg Byes: 2, Wickets : 1  Wides : 3, No Balls: 4 Penalty : 5,60,10.7"),
                "line 8", "BAD_OVERS", "'10.7'");
    }

    @Test
    void aLineBetweenSectionsThatBelongsToNoSectionFails() {
        assertSingleError(withLine(report(), 13, "something else entirely"),
                "line 13", "UNRECOGNISED_LINE", "not part of a CricClubs scorecard");
    }

    @Test
    void aThirdBattingSectionFails() {
        String text = report() + ",,,Hillside 4 Batting\n";

        assertSingleError(text, "line 25", "DUPLICATE_SECTION", "second batting section");
    }

    @Test
    void anUnclosedQuoteFailsWithItsLine() {
        assertSingleError(withLine(report(), 5, "\t\"Ann Alder,b,,Kay Kauri,5,10,0,0"),
                "line 5", "UNCLOSED_QUOTE", "never closed");
    }

    @Test
    void anEmptyFileFails() {
        assertSingleError("", "", "EMPTY_FILE", "empty");
        assertSingleError("   \n\t\n", "", "EMPTY_FILE", "empty");
        assertThat(invalid(() -> readBytes(new byte[0])).getErrors()).extracting(ImportErrorDto::code)
                .containsExactly("EMPTY_FILE");
    }

    @Test
    void someOtherCsvIsRefusedAsNotACricClubsReport() {
        assertSingleError("name,age,club\nAnn,31,Hillside\n", "line 1", "RESULT_LINE_NOT_UNDERSTOOD",
                "not a CricClubs scorecard export");
    }

    @Test
    void theRefusalCarriesAMessageNamingTheAdaptor() {
        ImportInputValidationException thrown = invalid(withLine(report(), 5, "\tAnn Alder,rtd,,Kay Kauri,5,10,0,0"));

        assertThat(thrown.getMessage()).isEqualTo("The file is not a CricClubs scorecard this adaptor can read.");
        assertThat(thrown.getTotalErrors()).isEqualTo(1);
    }
}
