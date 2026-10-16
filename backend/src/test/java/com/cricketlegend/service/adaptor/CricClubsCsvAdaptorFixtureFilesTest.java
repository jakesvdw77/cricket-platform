package com.cricketlegend.service.adaptor;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.dto.ImportedResultDto;
import com.cricketlegend.dto.ImportedResultDto.Batting;
import com.cricketlegend.dto.ImportedResultDto.Innings;
import com.cricketlegend.exception.ImportInputValidationException;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/107-match-results-cricclubs-csv-adaptor.md Test Plan, Fixtures: the CricClubs adaptor reads whole files with
 * the layout, line endings and encodings of real exports, from {@code src/test/resources/imports/results/cricclubs}.
 * The files use invented names only; the real exports stay in the git-ignored {@code docs/samples}.
 */
class CricClubsCsvAdaptorFixtureFilesTest {

    private static final Path DIRECTORY = Path.of("src/test/resources/imports/results/cricclubs");

    private final CricClubsCsvAdaptor adaptor = new CricClubsCsvAdaptor();

    private ImportedResultDto read(String name) throws IOException {
        return adaptor.importFrom(ImportInput.file(ImportInputFormat.CSV, name, Files.readAllBytes(DIRECTORY.resolve(name))));
    }

    private static Batting batter(Innings innings, String player) {
        return innings.batting().stream().filter(b -> b.player().equals(player)).findFirst().orElseThrow();
    }

    @Test
    void aChaseIsAWinByWicketsWithBothInningsRead() throws IOException {
        ImportedResultDto result = read("chase.csv");

        assertThat(result.match().date()).isEqualTo(LocalDate.of(2026, 10, 11));
        assertThat(result.result().outcome()).isEqualTo(ResultOutcomeType.WON);
        assertThat(result.result().winner()).isEqualTo("B");
        assertThat(result.result().margin().type()).isEqualTo(ResultMarginType.WICKETS);
        assertThat(result.result().margin().value()).isEqualTo(8);
        assertThat(result.result().scheduledOvers()).isEqualTo(20);

        Innings first = result.innings().get(0);
        assertThat(first.battingTeam()).isEqualTo("A");
        assertThat(first.runs()).isEqualTo(78);
        assertThat(first.wickets()).isEqualTo(7);
        assertThat(first.overs()).isEqualTo("19");
        assertThat(first.extras().wides()).isEqualTo(12);
        assertThat(first.extras().noBalls()).isEqualTo(1);
        assertThat(first.extras().byes()).isEqualTo(1);
        assertThat(first.extras().legByes()).isEqualTo(3);
        assertThat(first.extras().penalty()).isZero();
        assertThat(first.batting()).hasSize(8);
        assertThat(first.didNotBat()).containsExactly("Ivy Dummy", "Jon Stand", "Kit Filler");
        assertThat(first.bowling()).hasSize(4);
        assertThat(batter(first, "Anna Example").howOut()).isEqualTo(DismissalType.LBW);
        assertThat(batter(first, "Cal Invented").howOut()).isEqualTo(DismissalType.CAUGHT);
        assertThat(batter(first, "Fin Notreal").howOut()).isEqualTo(DismissalType.STUMPED);
        assertThat(batter(first, "Gil Sample").howOut()).isEqualTo(DismissalType.CAUGHT_AND_BOWLED);
        assertThat(batter(first, "Gil Sample").fielder()).isNull();
        assertThat(batter(first, "Eli Fiction").howOut()).isEqualTo(DismissalType.RUN_OUT);
        assertThat(batter(first, "Eli Fiction").bowler()).isNull();
        assertThat(batter(first, "Hugh Pretend").howOut()).isEqualTo(DismissalType.NOT_OUT);

        Innings second = result.innings().get(1);
        assertThat(second.battingTeam()).isEqualTo("B");
        assertThat(second.runs()).isEqualTo(80);
        assertThat(second.wickets()).isEqualTo(2);
        assertThat(second.overs()).isEqualTo("10.3");
    }

    @Test
    void aWinByRunsKeepsTheRetiredNotOutBattersAndTheSubstituteFielder() throws IOException {
        ImportedResultDto result = read("win-by-runs.csv");

        assertThat(result.result().winner()).isEqualTo("A");
        assertThat(result.result().margin().type()).isEqualTo(ResultMarginType.RUNS);
        assertThat(result.result().margin().value()).isEqualTo(135);
        Innings first = result.innings().get(0);
        assertThat(first.wickets()).isEqualTo(3);
        assertThat(batter(first, "Pat Alpha").howOut()).isEqualTo(DismissalType.RETIRED_NOT_OUT);
        assertThat(batter(first, "Tom Gamma").howOut()).isEqualTo(DismissalType.RETIRED_NOT_OUT);
        assertThat(first.didNotBat()).hasSize(5);
        Innings second = result.innings().get(1);
        assertThat(second.runs()).isEqualTo(57);
        assertThat(second.overs()).isEqualTo("11");
        assertThat(batter(second, "Val Zeta").howOut()).isEqualTo(DismissalType.CAUGHT);
        assertThat(batter(second, "Val Zeta").fielder()).isNull();
        assertThat(batter(second, "Val Zeta").bowler()).isEqualTo("Bo Mu");
        assertThat(batter(second, "Ian Tau").howOut()).isEqualTo(DismissalType.CAUGHT_AND_BOWLED);
        assertThat(batter(second, "Hal Sigma").howOut()).isEqualTo(DismissalType.RUN_OUT);
        assertThat(batter(second, "Hal Sigma").bowler()).isNull();
    }

    @Test
    void aFiftyOverPracticeMatchSavedAsWindows1252IsReadWithItsAccentedName() throws IOException {
        ImportedResultDto result = read("practice-50-overs-windows-1252.csv");

        assertThat(result.result().scheduledOvers()).isEqualTo(50);
        assertThat(result.match().competition()).isEqualTo("IPT");
        assertThat(result.match().date()).isEqualTo(LocalDate.of(2025, 11, 22));
        assertThat(result.result().winner()).isEqualTo("A");
        Innings first = result.innings().get(0);
        assertThat(first.runs()).isEqualTo(227);
        assertThat(first.overs()).isEqualTo("45");
        assertThat(first.wickets()).isEqualTo(5);
        assertThat(batter(first, "Cat Cedar").howOut()).isEqualTo(DismissalType.RETIRED_NOT_OUT);
        assertThat(batter(first, "Dot Dogwood").howOut()).isEqualTo(DismissalType.RETIRED_NOT_OUT);
        assertThat(batter(first, "Gwen Gum").fielder()).isEqualTo("Moré Maple");
        assertThat(first.bowling()).extracting(ImportedResultDto.Bowling::player).contains("Moré Maple");
        assertThat(result.innings().get(1).overs()).isEqualTo("35.5");
    }

    @Test
    void aTieIsReadWithNoWinner() throws IOException {
        ImportedResultDto result = read("tie.csv");

        assertThat(result.result().outcome()).isEqualTo(ResultOutcomeType.TIE);
        assertThat(result.result().winner()).isNull();
        assertThat(result.innings()).hasSize(2);
        assertThat(result.innings().get(0).runs()).isEqualTo(129);
        assertThat(result.innings().get(1).runs()).isEqualTo(129);
        assertThat(result.innings().get(1).wickets()).isEqualTo(7);
    }

    @Test
    void aForfeitIsAnOutcomeWithNoInnings() throws IOException {
        ImportedResultDto result = read("forfeit.csv");

        assertThat(result.result().outcome()).isEqualTo(ResultOutcomeType.FORFEIT);
        assertThat(result.result().winner()).isEqualTo("A");
        assertThat(result.innings()).isEmpty();
        assertThat(result.match().date()).isEqualTo(LocalDate.of(2026, 9, 13));
    }

    @Test
    void retiredBattersAreNotOutWhenTheStatedWicketsEqualTheDismissals() throws IOException {
        Innings innings = read("retired-not-out.csv").innings().get(0);

        assertThat(batter(innings, "Bob Birch").howOut()).isEqualTo(DismissalType.RETIRED_NOT_OUT);
    }

    @Test
    void retiredBattersAreOutWhenTheStatedWicketsCountThem() throws IOException {
        Innings innings = read("retired-out.csv").innings().get(0);

        assertThat(batter(innings, "Bob Birch").howOut()).isEqualTo(DismissalType.RETIRED_OUT);
    }

    @Test
    void retiredBattersFailWhenTheStatedWicketsFitNeitherReading() {
        ImportInputValidationException thrown = failure("retired-does-not-fit.csv");

        assertThat(thrown.getErrors()).singleElement().satisfies(error -> {
            assertThat(error.path()).isEqualTo("line 16");
            assertThat(error.code()).isEqualTo("WICKETS_DO_NOT_MATCH_BATTERS");
        });
    }

    @Test
    void anUnknownDismissalCodeFailsWithTheLineOfTheRow() {
        ImportInputValidationException thrown = failure("unknown-code.csv");

        assertThat(thrown.getErrors()).singleElement().satisfies(error -> {
            assertThat(error.path()).isEqualTo("line 10");
            assertThat(error.message()).contains("'rtd'");
        });
    }

    private ImportInputValidationException failure(String name) {
        try {
            read(name);
        } catch (ImportInputValidationException ex) {
            return ex;
        } catch (IOException ex) {
            throw new AssertionError(ex);
        }
        throw new AssertionError("expected " + name + " to be refused");
    }
}
