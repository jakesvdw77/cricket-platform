package com.cricketlegend.service.adaptor;

import static com.cricketlegend.support.StumpsPdfFixtures.pathOf;
import static com.cricketlegend.support.StumpsPdfFixtures.text;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultDecidedBy;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.TossDecision;
import com.cricketlegend.dto.ImportErrorDto;
import com.cricketlegend.dto.ImportedResultDto;
import com.cricketlegend.dto.ImportedResultDto.Batting;
import com.cricketlegend.dto.ImportedResultDto.Innings;
import com.cricketlegend.exception.ImportInputValidationException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * docs/specs/108-match-results-stumps-pdf-adaptor.md Test Plan, "Parser unit tests (no PDF)": every row of the mapping
 * table, every form of the result, the date and time, the venue, the extras, partial overs, a wrapped name, the ball-by-ball
 * pages that are ignored, and every failure with its page and line, code and message. The report is the masked template in
 * {@code StumpsPdfFixtures}; a variant is the default text with one piece replaced. Placeholder names only.
 */
class StumpsReportParserTest {

    private static ImportedResultDto parse(String text) {
        return StumpsReportParser.parse(StumpsLines.ofText(text));
    }

    private static List<ImportErrorDto> errors(String text) {
        ImportInputValidationException ex = catchFailure(text);
        // an error message may name the wording of a dismissal or a column, never a person or a team
        ex.getErrors().forEach(e -> assertThat(e.message()).doesNotContain("Player ").doesNotContain("Team A")
                .doesNotContain("Team B"));
        return ex.getErrors();
    }

    private static ImportInputValidationException catchFailure(String text) {
        try {
            parse(text);
        } catch (ImportInputValidationException ex) {
            return ex;
        }
        throw new AssertionError("the report was accepted");
    }

    private static ImportErrorDto onlyError(String text) {
        List<ImportErrorDto> errors = errors(text);
        assertThat(errors).hasSize(1);
        return errors.get(0);
    }

    private static Batting batter(Innings innings, String name) {
        return innings.batting().stream().filter(b -> name.equals(b.player())).findFirst().orElseThrow();
    }

    // ---- the whole report ----

    @Test
    void theDefaultReportBecomesTheCommonDocument() {
        ImportedResultDto doc = parse(text());

        assertThat(doc.schemaVersion()).isEqualTo(1);
        assertThat(doc.source().provider()).isEqualTo("STUMPS");
        assertThat(doc.source().externalMatchId()).isEqualTo("tst00001");
        assertThat(doc.match().date()).isEqualTo(LocalDate.of(2026, 11, 21));
        assertThat(doc.match().startTime()).isEqualTo(LocalTime.of(13, 30));
        assertThat(doc.match().venue()).isEqualTo("Placeholder Ground");
        assertThat(doc.teams()).extracting("key", "name").containsExactly(
                org.assertj.core.groups.Tuple.tuple("A", "Team A U15"), org.assertj.core.groups.Tuple.tuple("B", "Team B U15"));
        assertThat(doc.toss().wonBy()).isEqualTo("A");
        assertThat(doc.toss().decision()).isEqualTo(TossDecision.BAT);
        assertThat(doc.result().outcome()).isEqualTo(ResultOutcomeType.WON);
        assertThat(doc.result().winner()).isEqualTo("B");
        assertThat(doc.result().margin().type()).isEqualTo(ResultMarginType.WICKETS);
        assertThat(doc.result().margin().value()).isEqualTo(6);
        assertThat(doc.result().decidedBy()).isNull();
        assertThat(doc.result().dls()).isNull();
        assertThat(doc.result().scheduledOvers()).isEqualTo(20);
        assertThat(doc.awards()).as("'-' means no player of the match").isNull();
        assertThat(doc.innings()).hasSize(2);

        Innings first = doc.innings().get(0);
        assertThat(first.battingTeam()).isEqualTo("A");
        assertThat(first.kind()).isEqualTo(InningsKind.REGULAR);
        assertThat(first.runs()).isEqualTo(105);
        assertThat(first.wickets()).isEqualTo(6);
        assertThat(first.overs()).isEqualTo("20.0");
        assertThat(first.extras()).satisfies(e -> {
            assertThat(e.byes()).isEqualTo(2);
            assertThat(e.legByes()).isEqualTo(1);
            assertThat(e.wides()).isEqualTo(6);
            assertThat(e.noBalls()).isEqualTo(1);
            assertThat(e.penalty()).as("penalty is not in the report").isNull();
        });
        assertThat(first.batting()).as("fewer than 11 batters is fine").hasSize(8);
        assertThat(first.bowling()).hasSize(5);
        assertThat(first.bowling().get(0)).satisfies(b -> {
            assertThat(b.player()).isEqualTo("Player 14");
            assertThat(b.overs()).isEqualTo("4.0");
            assertThat(b.maidens()).isZero();
            assertThat(b.runs()).isEqualTo(22);
            assertThat(b.wickets()).isEqualTo(3);
            assertThat(b.dots()).isEqualTo(14);
            assertThat(b.wides()).isEqualTo(2);
            assertThat(b.noBalls()).isZero();
        });
        assertThat(first.bowling().get(4).noBalls()).isEqualTo(1);

        Innings second = doc.innings().get(1);
        assertThat(second.battingTeam()).isEqualTo("B");
        assertThat(second.runs()).isEqualTo(111);
        assertThat(second.wickets()).isEqualTo(4);
        assertThat(second.overs()).isEqualTo("17.3");
        assertThat(second.extras().legByes()).isEqualTo(2);
        assertThat(second.extras().byes()).isZero();
        assertThat(second.batting()).hasSize(6);
        assertThat(second.bowling()).hasSize(5);
        assertThat(second.bowling().get(4).overs()).as("a partial over is kept as written").isEqualTo("2.3");
    }

    @Test
    void everyDismissalFormMapsAsInTheSpec() {
        Innings first = parse(text()).innings().get(0);

        Batting bowled = batter(first, "Player 1");
        assertThat(bowled.howOut()).isEqualTo(DismissalType.BOWLED);
        assertThat(bowled.bowler()).isEqualTo("Player 14");
        assertThat(bowled.fielder()).isNull();
        assertThat(bowled.runs()).isEqualTo(20);
        assertThat(bowled.balls()).isEqualTo(25);
        assertThat(bowled.fours()).isEqualTo(2);
        assertThat(bowled.sixes()).isZero();

        Batting caught = batter(first, "Player 2");
        assertThat(caught.howOut()).isEqualTo(DismissalType.CAUGHT);
        assertThat(caught.fielder()).isEqualTo("Player 15");
        assertThat(caught.bowler()).isEqualTo("Player 14");

        Batting caughtAndBowled = batter(first, "Player 3");
        assertThat(caughtAndBowled.howOut()).isEqualTo(DismissalType.CAUGHT_AND_BOWLED);
        assertThat(caughtAndBowled.bowler()).isEqualTo("Player 16");
        assertThat(caughtAndBowled.fielder()).isNull();

        Batting lbw = batter(first, "Player 4");
        assertThat(lbw.howOut()).isEqualTo(DismissalType.LBW);
        assertThat(lbw.bowler()).isEqualTo("Player 14");

        Batting runOut = batter(first, "Player 5");
        assertThat(runOut.howOut()).isEqualTo(DismissalType.RUN_OUT);
        assertThat(runOut.fielder()).isEqualTo("Player 17");
        assertThat(runOut.bowler()).isNull();

        Batting notOut = batter(first, "Player 7");
        assertThat(notOut.howOut()).isEqualTo(DismissalType.NOT_OUT);
        assertThat(notOut.bowler()).isNull();
        assertThat(notOut.fielder()).isNull();
        assertThat(notOut.sixes()).isEqualTo(1);
    }

    // ---- the result ----

    @Test
    void aWinByRunsKeepsTheMarginAndTheWinner() {
        ImportedResultDto doc = parse(text().replace("Team B U15 won by 6 wickets", "Team A U15 won by 15 runs"));

        assertThat(doc.result().winner()).isEqualTo("A");
        assertThat(doc.result().margin().type()).isEqualTo(ResultMarginType.RUNS);
        assertThat(doc.result().margin().value()).isEqualTo(15);
        assertThat(doc.result().decidedBy()).isNull();
    }

    @Test
    void aDlsResultSetsDecidedByWithoutInventingATarget() {
        ImportedResultDto doc = parse(text().replace("Team B U15 won by 6 wickets", "Team B U15 won by 6 runs (D/L Method)"));

        assertThat(doc.result().decidedBy()).isEqualTo(ResultDecidedBy.DLS);
        assertThat(doc.result().margin().type()).isEqualTo(ResultMarginType.RUNS);
        assertThat(doc.result().margin().value()).isEqualTo(6);
        assertThat(doc.result().dls()).isNull();
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "Team B U15 won by 6|wickets",
            "Team B U15 won by 6 wickets|",
            "Team B U15 won by 6 runs (D/L|Method)",
            "Team B U15 won by 6 runs|(D/L Method)",
            "Team B U15 won by|6 wickets"})
    void aResultLineThatWrapsOntoASecondLineIsJoined(String firstLine, String secondLine) {
        String result = secondLine == null ? firstLine : firstLine + "\n" + secondLine;

        ImportedResultDto doc = parse(text().replace("Team B U15 won by 6 wickets", result));

        assertThat(doc.result().winner()).isEqualTo("B");
        assertThat(doc.result().margin().value()).isEqualTo(6);
    }

    @Test
    void theWinnerIsMatchedIgnoringCaseAndSpacing() {
        ImportedResultDto doc = parse(text().replace("Team B U15 won by 6 wickets", "TEAM  B u15 won by 6 wickets"));

        assertThat(doc.result().winner()).isEqualTo("B");
    }

    @Test
    void aWinnerThatIsNeitherTeamFails() {
        String text = text().replace("Team B U15 won by 6 wickets", "Team C U15 won by 6 wickets");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("WINNER_NOT_FOUND");
        assertThat(error.path()).isEqualTo(pathOf(text, "Team C U15 won by 6 wickets"));
        assertThat(error.message()).contains("not one of the two teams");
    }

    @Test
    void aResultThatIsNotAWinFailsRatherThanBeingGuessed() {
        String text = text().replace("Team B U15 won by 6 wickets", "Match tied");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("RESULT_NOT_UNDERSTOOD");
        assertThat(error.path()).isEqualTo(pathOf(text, "Match tied"));
    }

    // ---- the match information ----

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "21 Nov 2026 01:30 PM|2026-11-21|13:30",
            "21 Nov 2026 08:01 AM|2026-11-21|08:01",
            "01 Jan 2027 12:00 PM|2027-01-01|12:00",
            "1 Feb 2027 12:15 PM|2027-02-01|12:15",
            "29 Feb 2028 12:15 AM|2028-02-29|00:15",
            "31 Dec 2026 11:59 PM|2026-12-31|23:59",
            "5 Sep 2026 12:00 AM|2026-09-05|00:00"})
    void theDateAndTimeAreReadOnATwelveHourClock(String written, String date, String time) {
        ImportedResultDto doc = parse(text().replace("21 Nov 2026 01:30 PM", written));

        assertThat(doc.match().date()).isEqualTo(LocalDate.parse(date));
        assertThat(doc.match().startTime()).isEqualTo(LocalTime.parse(time));
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "31 Feb 2026 01:30 PM", "21 Foo 2026 01:30 PM", "21 Nov 2026 13:30 PM", "21 Nov 2026 00:30 AM",
            "21 Nov 2026 01:75 PM", "21 Nov 2026", "21/11/2026 01:30 PM"})
    void aDateOrTimeThatIsNotReadableFails(String written) {
        String text = text().replace("21 Nov 2026 01:30 PM", written);

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("INVALID_DATE");
        assertThat(error.path()).isEqualTo(pathOf(text, "Date & Time " + written));
    }

    @Test
    void anEmptyVenueIsLeftEmpty() {
        assertThat(parse(text().replace("Venue Placeholder Ground", "Venue")).match().venue()).isNull();
    }

    @Test
    void aVenueThatWrapsIsJoined() {
        ImportedResultDto doc = parse(text().replace("Venue Placeholder Ground", "Venue Placeholder Ground\nand Pavilion"));

        assertThat(doc.match().venue()).isEqualTo("Placeholder Ground and Pavilion");
    }

    @Test
    void theOversOfTheMatchAreTheScheduledOvers() {
        assertThat(parse(text().replace("Overs 20", "Overs 24")).result().scheduledOvers()).isEqualTo(24);
    }

    @Test
    void theTossIsMatchedToATeamAndReadAsBatOrBowl() {
        ImportedResultDto bowl = parse(text().replace("Toss Team A U15 Opted To Bat", "Toss Team B U15 Elected To Bowl"));

        assertThat(bowl.toss().wonBy()).isEqualTo("B");
        assertThat(bowl.toss().decision()).isEqualTo(TossDecision.BOWL);
    }

    @Test
    void aTossTeamThatIsNeitherTeamFails() {
        String text = text().replace("Toss Team A U15 Opted To Bat", "Toss Team C U15 Opted To Bat");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("TOSS_NOT_UNDERSTOOD");
        assertThat(error.path()).isEqualTo(pathOf(text, "Toss Team C U15 Opted To Bat"));
        assertThat(error.message()).contains("not one of the two teams");
    }

    @Test
    void aTossLineThatIsNotUnderstoodFails() {
        String text = text().replace("Toss Team A U15 Opted To Bat", "Toss Team A U15 chose to field");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("TOSS_NOT_UNDERSTOOD");
        assertThat(error.path()).isEqualTo(pathOf(text, "Toss Team A U15 chose to field"));
    }

    @Test
    void thePlayerOfTheMatchIsReadWhenThereIsOne() {
        ImportedResultDto doc = parse(text().replace("Player Of The Match\n-", "Player Of The Match\nPlayer 18"));

        assertThat(doc.awards().playerOfMatch().name()).isEqualTo("Player 18");
        assertThat(doc.awards().playerOfMatch().team()).as("the manager sees the team in Review").isNull();
    }

    @Test
    void theMatchIdIsRequired() {
        String text = text().replace("Match ID tst00001\n", "");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("MISSING_SECTION");
        assertThat(error.path()).isEqualTo("summary");
        assertThat(error.message()).contains("Match ID");
    }

    @Test
    void theOversOfTheMatchMustBeAWholeNumber() {
        String text = text().replace("Overs 20\n", "Overs twenty\n");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("BAD_NUMBER");
        assertThat(error.path()).isEqualTo(pathOf(text, "Overs twenty"));
    }

    // ---- the banner and the pages ----

    @Test
    void theBannerOnEveryPageIsNotPartOfTheReport() {
        // the same report with the download line missing from the banner still reads
        ImportedResultDto doc = parse(text().replace("Download 'STUMPS - The Cricket Scorer' app from Android's Play Store"
                + " or Apple's App Store\n", ""));

        assertThat(doc.innings()).hasSize(2);
    }

    @Test
    void theBallByBallPagesAreIgnoredWhateverTheyContain() {
        String withoutThem = text().substring(0, text().lastIndexOf('\f'));

        assertThat(parse(withoutThem)).usingRecursiveComparison().isEqualTo(parse(text()));
    }

    @Test
    void aBowlingTableThatContinuesOnTheNextPageIsOneTable() {
        // the same bowlers with a page break (and its banner) in the middle of the table
        String text = text().replace("Player 3 4.0 0 22 1 5.5 12 2 0 1 0\n", "Player 3 4.0 0 22 1 5.5 12 2 0 1 0\f"
                + com.cricketlegend.support.StumpsPdfFixtures.BANNER);

        assertThat(parse(text).innings().get(1).bowling()).hasSize(5);
    }

    // ---- the batting card ----

    @Test
    void aBatterNameThatWrapsIsJoinedUsingTheFiguresLineAsTheEnd() {
        ImportedResultDto doc = parse(text().replace("Player 1\nb Player 14\n20 25",
                "Player 1 With A Very\nLong Surname\nb Player 14\n20 25"));

        Batting joined = doc.innings().get(0).batting().get(0);
        assertThat(joined.player()).isEqualTo("Player 1 With A Very Long Surname");
        assertThat(joined.howOut()).isEqualTo(DismissalType.BOWLED);
        assertThat(joined.runs()).isEqualTo(20);
    }

    @Test
    void aDismissalThatWrapsIsJoined() {
        ImportedResultDto doc = parse(text().replace("c Player 15 b Player 14", "c Player 15 b\nPlayer 14"));

        Batting caught = batter(doc.innings().get(0), "Player 2");
        assertThat(caught.howOut()).isEqualTo(DismissalType.CAUGHT);
        assertThat(caught.fielder()).isEqualTo("Player 15");
        assertThat(caught.bowler()).isEqualTo("Player 14");
    }

    @Test
    void aNameAndADismissalThatBothWrapAreBothJoined() {
        ImportedResultDto doc = parse(text().replace("Player 2\nc Player 15 b Player 14",
                "Player 2 With\nLong Name\nc Player 15 b\nPlayer 14"));

        Batting caught = doc.innings().get(0).batting().get(1);
        assertThat(caught.player()).isEqualTo("Player 2 With Long Name");
        assertThat(caught.bowler()).isEqualTo("Player 14");
    }

    @Test
    void extrasAreReadWithAndWithoutLegByesAndWithAnyOfTheOthersAbsent() {
        Innings legByes = parse(text()).innings().get(0);
        assertThat(legByes.extras().legByes()).isEqualTo(1);

        Innings none = parse(text().replace("( B 2 | LB 1 | WD 6 | NB 1 )", "( B 2 | WD 6 | NB 1 )")).innings().get(0);
        assertThat(none.extras().legByes()).isZero();
        assertThat(none.extras().byes()).isEqualTo(2);

        Innings widesOnly = parse(text().replace("( B 2 | LB 1 | WD 6 | NB 1 )", "( WD 6 )")).innings().get(0);
        assertThat(widesOnly.extras().wides()).isEqualTo(6);
        assertThat(widesOnly.extras().byes()).isZero();
        assertThat(widesOnly.extras().noBalls()).isZero();

        Innings empty = parse(text().replace("( B 2 | LB 1 | WD 6 | NB 1 )", "( )")).innings().get(0);
        assertThat(empty.extras().wides()).isZero();
    }

    @Test
    void aBowlerWithNoWicketsAndWholeOversIsRead() {
        Innings first = parse(text()).innings().get(0);

        assertThat(first.bowling().get(1).overs()).isEqualTo("4.0");
        assertThat(first.bowling().get(1).wickets()).isZero();
    }

    // ---- failures: what is not a STUMPS report ----

    @Test
    void textThatIsNotAStumpsReportIsRefused() {
        ImportErrorDto error = onlyError("Some other document\nwith a few lines\n");

        assertThat(error.code()).isEqualTo("NOT_A_STUMPS_REPORT");
        assertThat(error.path()).isEmpty();
        assertThat(error.message()).contains("not a STUMPS match report");
    }

    @Test
    void aBannerWithoutTheMatchReportHeadingIsRefused() {
        String text = text().replace("Match Report\n", "Something Else\n");

        assertThat(onlyError(text).code()).isEqualTo("NOT_A_STUMPS_REPORT");
    }

    @Test
    void noLinesAtAllIsNotAStumpsReport() {
        assertThat(onlyError("").code()).isEqualTo("NOT_A_STUMPS_REPORT");
    }

    // ---- failures: structure ----

    @Test
    void aMissingSecondInningsStopsTheRead() {
        String text = text().substring(0, text().indexOf("2nd Innings Scorecard"));

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("MISSING_SECTION");
    }

    @Test
    void aMissingMatchSummaryFails() {
        ImportErrorDto error = onlyError(text().replace("Match Summary\n", ""));

        assertThat(error.code()).isEqualTo("MISSING_SECTION");
        assertThat(error.path()).isEqualTo("summary");
    }

    @Test
    void aMissingResultLineFails() {
        String text = text().replace("Result\n", "");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("UNRECOGNISED_LINE");
        assertThat(error.path()).isNotEmpty();
    }

    @Test
    void aBattingCardOfAnUnknownTeamFails() {
        String text = text().replace("Team B U15 R B 4s 6s SR", "Team C U15 R B 4s 6s SR");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("TEAM_NOT_FOUND");
        assertThat(error.path()).isEqualTo(pathOf(text, "Team C U15 R B 4s 6s SR"));
    }

    @Test
    void aThirdInningsIsNotSupported() {
        String text = text().replace("Over Comparison", "3rd Innings Scorecard");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("UNRECOGNISED_LINE");
        assertThat(error.message()).contains("third innings");
    }

    @Test
    void twoTeamsWithTheSameNameCannotBeToldApart() {
        String text = text().replace("Team B U15\n111-4", "Team A U15\n111-4");

        assertThat(onlyError(text).code()).isEqualTo("TEAMS_SAME_NAME");
    }

    @Test
    void aBatterWithNoFiguresIsIncomplete() {
        String text = text().replace("20 25 2 0 80.0\n", "");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("BATTER_INCOMPLETE");
        assertThat(error.path()).isEqualTo(pathOf(text, "Player 1"));
    }

    @Test
    void aLineThatIsNotUnderstoodInABowlingTableFailsWithItsPageAndLine() {
        String text = text().replace("Player 15 4.0 0 20 0 5.0 12 1 0 1 0", "Something odd that is not a bowler");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("UNRECOGNISED_LINE");
        assertThat(error.path()).isEqualTo(pathOf(text, "Something odd that is not a bowler"));
        assertThat(error.message()).contains("bowler's line");
    }

    @Test
    void aLineThatIsNotUnderstoodAfterTheSecondBowlingTableAndBeforeTheBallByBallFails() {
        String text = text().replace("Player 5 2.3 0 24 0 9.6 5 3 0 0 0", "Player 5 2.3 0 24 0 9.6 5 3 0 0 0\nStray line");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("UNRECOGNISED_LINE");
        assertThat(error.path()).isEqualTo(pathOf(text, "Stray line"));
    }

    @Test
    void aLineThatIsNotTheExtrasFails() {
        String text = text().replace("( B 2 | LB 1 | WD 6 | NB 1 )", "B 2 WD 6");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("UNRECOGNISED_LINE");
        assertThat(error.path()).isEqualTo(pathOf(text, "B 2 WD 6"));
    }

    @Test
    void anExtraThatIsNotOneOfTheKnownFails() {
        String text = text().replace("( B 2 | LB 1 | WD 6 | NB 1 )", "( B 2 | PEN 5 )");

        assertThat(onlyError(text).code()).isEqualTo("UNRECOGNISED_LINE");
    }

    // ---- failures: a batter row that is not a batter ----

    @Test
    void aDidNotBatRowWithNoFiguresFollowedByARealBatterIsNotMergedIntoIt() {
        String text = text().replace("Player 6\nb Player 16\n", "Player 9\nDid not bat\nPlayer 6\nb Player 16\n");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("BATTER_INCOMPLETE");
        assertThat(error.path()).isEqualTo(pathOf(text, "Player 9"));
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {"Did not bat", "did not bat", "Absent hurt", "Retired hurt", "Yet to bat"})
    void aMarkerWhereANameShouldBeIsRefusedAtItsOwnLine(String marker) {
        String text = text().replace("Player 6\nb Player 16\n", "Player 6\n" + marker + "\nb Player 16\n");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("BATTER_INCOMPLETE");
        assertThat(error.path()).isEqualTo(pathOf(text, marker));
    }

    @Test
    void anAbsentRowWithNoFiguresIsNotMergedIntoTheNextBatterEither() {
        String text = text().replace("Player 6\nb Player 16\n", "Player 6\nabsent\nb Player 16\n");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("BATTER_INCOMPLETE");
        assertThat(error.path()).isEqualTo(pathOf(text, "Player 6"));
    }

    @Test
    void aBatterNameCanWrapOverTwoLinesButNotThree() {
        String threeLines = text().replace("Player 6\nb Player 16\n", "Player 6 With\nA Very Long\nSurname\nb Player 16\n");

        ImportErrorDto error = onlyError(threeLines);

        assertThat(error.code()).isEqualTo("BATTER_INCOMPLETE");
        assertThat(error.path()).isEqualTo(pathOf(threeLines, "Player 6 With"));
    }

    @Test
    void aBowlingTableWithNoBowlerRowsIsAMissingSectionInEitherInnings() {
        String firstEmpty = text().replaceAll("(?m)^Player 1[4-8] \\d\\.\\d \\d+ .*\\n", "");
        String secondEmpty = text().replaceAll("(?m)^Player [1-5] \\d\\.\\d \\d+ \\d+ \\d+ .*\\n", "");

        ImportErrorDto first = onlyError(firstEmpty);
        ImportErrorDto second = onlyError(secondEmpty);

        assertThat(first.code()).isEqualTo("MISSING_SECTION");
        assertThat(first.path()).isEqualTo("page 3, line 4");
        assertThat(second.code()).isEqualTo("MISSING_SECTION");
        assertThat(second.path()).isEqualTo("page 4, line 4");
    }

    // ---- failures: dismissals ----

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "st Player 3 b Player 16|'st'",
            "stumped Player 3 b Player 16|'stumped'",
            "hit wicket b Player 16|'hit'",
            "retired hurt|'retired'",
            "timed out|'timed'",
            "handled the ball|'handled'",
            "obstructing the field|'obstructing'"})
    void anUnknownDismissalFailsWithItsPageLineAndWordingAndNeverAName(String wording, String quoted) {
        String text = text().replace("lbw Player 14", wording);

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("UNKNOWN_DISMISSAL");
        assertThat(error.path()).isEqualTo(pathOf(text, wording));
        assertThat(error.message()).contains(quoted).contains("is not one this adaptor knows");
    }

    @Test
    void aDismissalWordingThatIsNotADismissalWordIsNeverQuoted() {
        String text = text().replace("lbw Player 14", "Mystery Player 14");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("UNKNOWN_DISMISSAL");
        assertThat(error.message()).doesNotContain("Mystery").contains("not a word this adaptor recognises");
    }

    @Test
    void everyUnknownDismissalIsReportedTogether() {
        String text = text().replace("lbw Player 14", "st Player 3 b Player 16").replace("b Player 3\n", "retired hurt\n");

        List<ImportErrorDto> errors = errors(text);

        assertThat(errors).extracting(ImportErrorDto::code).containsExactly("UNKNOWN_DISMISSAL", "UNKNOWN_DISMISSAL");
        assertThat(errors).extracting(ImportErrorDto::path).doesNotHaveDuplicates();
    }

    @Test
    void aCapitalBInsideAFielderNameIsPartOfTheNameNotTheSeparator() {
        ImportedResultDto doc = parse(text().replace("c Player 15 b Player 14", "c Player 15 B Smith b Player 14"));

        Batting caught = batter(doc.innings().get(0), "Player 2");
        assertThat(caught.howOut()).isEqualTo(DismissalType.CAUGHT);
        assertThat(caught.fielder()).isEqualTo("Player 15 B Smith");
        assertThat(caught.bowler()).isEqualTo("Player 14");
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "c Player 15 b Player 14|c Player 15 b Player 12 b Player 14",
            "b Player 16|b Player 16 b Player 12",
            "c & b Player 16|c & b Player 16 b Player 12",
            "lbw Player 14|lbw Player 14 b Player 12",
            "runout (Player 17)|runout (Player 17) b Player 12"})
    void aDismissalWithMoreThanOneLowerCaseBIsAmbiguousAndQuotesNoName(String original, String ambiguous) {
        String text = text().replace("\n" + original + "\n", "\n" + ambiguous + "\n");

        List<ImportErrorDto> errors = errors(text);

        assertThat(errors).extracting(ImportErrorDto::code).containsOnly("UNKNOWN_DISMISSAL");
        assertThat(errors.get(0).path()).isEqualTo(pathOf(text, ambiguous));
        assertThat(errors.get(0).message()).contains("cannot be told apart");
    }

    @Test
    void aRunOutWithTwoFieldersIsRefusedNotPassedOnAsOneName() {
        for (String fielders : List.of("Player 17 / Player 18", "Player 17, Player 18", "Player 17/Player 18")) {
            String wording = "runout (" + fielders + ")";
            String text = text().replace("runout (Player 17)", wording);

            ImportErrorDto error = onlyError(text);

            assertThat(error.code()).isEqualTo("UNKNOWN_DISMISSAL");
            assertThat(error.path()).isEqualTo(pathOf(text, wording));
            assertThat(error.message()).contains("more than one fielder");
        }
    }

    // ---- failures: numbers ----

    @Test
    void aBadFigureOnABattersLineFails() {
        String text = text().replace("20 25 2 0 80.0", "20 25.5 2 0 80.0");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("BAD_NUMBER");
        assertThat(error.path()).isEqualTo(pathOf(text, "20 25.5 2 0 80.0"));
    }

    @Test
    void aBadOversInTheBowlingTableFails() {
        String text = text().replace("Player 14 4.0 0 22 3", "Player 14 4.7 0 22 3");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("BAD_NUMBER");
        assertThat(error.path()).isEqualTo(pathOf(text, "Player 14 4.7 0 22 3 5.5 14 2 0 2 0"));
        assertThat(error.message()).contains("4.7");
    }

    @Test
    void aFractionWhereAWholeNumberIsExpectedInTheBowlingTableFails() {
        String text = text().replace("Player 14 4.0 0 22 3", "Player 14 4.0 0 22.5 3");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("BAD_NUMBER");
        assertThat(error.message()).contains("22.5");
    }

    @Test
    void aBadExtrasNumberFails() {
        String text = text().replace("( B 2 | LB 1 | WD 6 | NB 1 )", "( B 2 | LB x | WD 6 | NB 1 )");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("BAD_NUMBER");
        assertThat(error.path()).isEqualTo(pathOf(text, "( B 2 | LB x | WD 6 | NB 1 )"));
    }

    @Test
    void aBadInningsOversFails() {
        String text = text().replace("10 Overs 20.0", "10 Overs 20.7");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("BAD_NUMBER");
        assertThat(error.path()).isEqualTo(pathOf(text, "10 Overs 20.7"));
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {"20.", ".5", "20.55", "2o.0", "1000.0", "20.0.1", "20,0"})
    void aMalformedInningsOversTokenIsRefused(String overs) {
        String text = text().replace("10 Overs 20.0", "10 Overs " + overs);

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("BAD_NUMBER");
        assertThat(error.path()).isEqualTo(pathOf(text, "10 Overs " + overs));
    }

    @Test
    void aRepeatedExtrasPartIsRefusedNotSilentlyOverwritten() {
        String text = text().replace("( B 2 | LB 1 | WD 6 | NB 1 )", "( B 2 | B 3 | LB 1 | WD 6 | NB 1 )");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("UNRECOGNISED_LINE");
        assertThat(error.path()).isEqualTo(pathOf(text, "( B 2 | B 3 | LB 1 | WD 6 | NB 1 )"));
        assertThat(error.message()).contains("'B' more than once");
    }

    @Test
    void aBadTotalFails() {
        String text = text().replace("105/6", "105/x");

        ImportErrorDto error = onlyError(text);

        assertThat(error.code()).isEqualTo("BAD_NUMBER");
        assertThat(error.path()).isEqualTo(pathOf(text, "105/x"));
    }

    @Test
    void everyBadNumberIsReportedTogether() {
        String text = text().replace("20 25 2 0 80.0", "20 25.5 2 0 80.0").replace("Player 14 4.0 0 22 3", "Player 14 4.7 0 22 3");

        assertThat(errors(text)).extracting(ImportErrorDto::code).containsExactly("BAD_NUMBER", "BAD_NUMBER");
    }

    @Test
    void aFailureThrowsTheStandardExceptionWithAPlainMessage() {
        assertThatThrownBy(() -> parse("not a report"))
                .isInstanceOf(ImportInputValidationException.class)
                .hasMessage("The file is not a STUMPS match report this adaptor can read.");
    }
}
