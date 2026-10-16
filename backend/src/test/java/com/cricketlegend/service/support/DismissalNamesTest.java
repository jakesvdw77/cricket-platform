package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.service.support.DismissalNames.Mention;
import com.cricketlegend.service.support.DismissalNames.Result;
import com.cricketlegend.service.support.DismissalNames.Role;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/104 U9, closed-world dismissal reading: a dismissal's text is read against the names the report's own
 * lists already established, the longest known name at each position wins, and a name that is not in the lists is
 * reported, never invented. Invented names only.
 */
class DismissalNamesTest {

    private static final List<String> KNOWN = List.of("Nazar", "Nazar A", "Cd Bright", "Jon Smith", "Smith");

    @Test
    void theLongestKnownNameWinsSoNazarAIsNeverReadAsNazar() {
        Result result = DismissalNames.resolve("c Nazar A b Cd Bright", KNOWN);

        assertThat(result.mentions()).containsExactly(
                new Mention("Nazar A", Role.FIELDER), new Mention("Cd Bright", Role.BOWLER));
        assertThat(result.fielder()).isEqualTo("Nazar A");
        assertThat(result.bowler()).isEqualTo("Cd Bright");
        assertThat(result.unmatched()).isEmpty();
    }

    @Test
    void theShorterNameIsUsedWhenTheLongerOneIsNotThere() {
        Result result = DismissalNames.resolve("c Nazar b Cd Bright", KNOWN);

        assertThat(result.fielder()).isEqualTo("Nazar");
        assertThat(result.bowler()).isEqualTo("Cd Bright");
    }

    @Test
    void aNameNotInTheListsIsReportedNotInvented() {
        Result result = DismissalNames.resolve("c Zane Quirk b Cd Bright", KNOWN);

        assertThat(result.fielder()).isNull();
        assertThat(result.bowler()).isEqualTo("Cd Bright");
        assertThat(result.unmatched()).containsExactly("Zane", "Quirk");
    }

    @Test
    void anUnknownBowlerIsReportedAndLeavesTheBowlerEmpty() {
        Result result = DismissalNames.resolve("c Nazar A b Pat Jones", KNOWN);

        assertThat(result.fielder()).isEqualTo("Nazar A");
        assertThat(result.bowler()).isNull();
        assertThat(result.unmatched()).containsExactly("Pat", "Jones");
    }

    @Test
    void caseAccentsAndPunctuationDoNotMatterButTheReportsOwnSpellingIsReturned() {
        Result result = DismissalNames.resolve("C NAZAR, a  B cd BRIGHT", KNOWN);

        assertThat(result.fielder()).isEqualTo("Nazar A");
        assertThat(result.bowler()).isEqualTo("Cd Bright");
    }

    @Test
    void aBowledDismissalHasOnlyABowler() {
        Result result = DismissalNames.resolve("b Cd Bright", KNOWN);

        assertThat(result.mentions()).containsExactly(new Mention("Cd Bright", Role.BOWLER));
        assertThat(result.fielder()).isNull();
    }

    @Test
    void caughtAndBowledNamesTheBowlerOnly() {
        Result result = DismissalNames.resolve("c & b Cd Bright", KNOWN);

        assertThat(result.mentions()).containsExactly(new Mention("Cd Bright", Role.BOWLER));
        assertThat(result.unmatched()).isEmpty();
    }

    @Test
    void aRunOutWithBracketsNamesAFielderOnly() {
        Result result = DismissalNames.resolve("run out (Nazar A)", KNOWN);

        assertThat(result.mentions()).containsExactly(new Mention("Nazar A", Role.FIELDER));
        assertThat(result.unmatched()).isEmpty();
    }

    @Test
    void aStumpingNamesTheKeeperAndTheBowler() {
        Result result = DismissalNames.resolve("st Jon Smith b Cd Bright", KNOWN);

        assertThat(result.fielder()).isEqualTo("Jon Smith");
        assertThat(result.bowler()).isEqualTo("Cd Bright");
    }

    @Test
    void theSamePersonMayBeBothFielderAndBowler() {
        Result result = DismissalNames.resolve("c Cd Bright b Cd Bright", KNOWN);

        assertThat(result.fielder()).isEqualTo("Cd Bright");
        assertThat(result.bowler()).isEqualTo("Cd Bright");
    }

    @Test
    void dismissalVocabularyIsNotReportedAsUnmatched() {
        assertThat(DismissalNames.resolve("not out", KNOWN).unmatched()).isEmpty();
        assertThat(DismissalNames.resolve("lbw b Cd Bright", KNOWN).unmatched()).isEmpty();
        assertThat(DismissalNames.resolve("hit wicket b Cd Bright", KNOWN).unmatched()).isEmpty();
        assertThat(DismissalNames.resolve("retired hurt", KNOWN).unmatched()).isEmpty();
    }

    @Test
    void aStandaloneBWithNoKnownNameAfterItIsJustVocabulary() {
        Result result = DismissalNames.resolve("c Nazar A b", KNOWN);

        assertThat(result.fielder()).isEqualTo("Nazar A");
        assertThat(result.unmatched()).isEmpty();
    }

    @Test
    void noKnownNamesAndEmptyTextGiveNothing() {
        Result none = DismissalNames.resolve("c Nazar A b Cd Bright", List.of());
        Result empty = DismissalNames.resolve("", KNOWN);

        assertThat(none.mentions()).isEmpty();
        assertThat(none.unmatched()).containsExactly("Nazar", "A", "Cd", "Bright");
        assertThat(empty.mentions()).isEmpty();
        assertThat(empty.unmatched()).isEmpty();
    }
}
