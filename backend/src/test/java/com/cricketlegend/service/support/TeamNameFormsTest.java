package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.ResultSide;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * docs/specs/104-match-results-import-adaptors.md, team names across scoring systems. Pairs are written the way the real
 * scoring systems write them (CricClubs, STUMPS and the club's own names).
 */
class TeamNameFormsTest {

    @ParameterizedTest
    @CsvSource({
            "Irene Villagers U15, Irene Villagers Under 15",
            "IRENE VILLAGERS U15, Irene Villagers Under-15",
            "Irene Villagers U/15, irene villagers u15",
            "Irene Villagers Under15, Irene Villagers U 15",
            "Pretoria  A, PRETORIA A",
            "Cbc Old Boys, C.B.C. Old Boys"})
    void sameWordsOnceTheAgeGroupAndPunctuationAreWrittenOneWay(String a, String b) {
        assertThat(TeamNameForms.words(a)).isEqualTo(TeamNameForms.words(b));
    }

    @Test
    void anAgeGroupIsNotANumberAndAPlainNumberIs() {
        assertThat(TeamNameForms.numbers(TeamNameForms.words("Irene Villagers U15"))).isEmpty();
        assertThat(TeamNameForms.numbers(TeamNameForms.words("Irene Villagers 1"))).containsExactly("1");
    }

    @ParameterizedTest
    @CsvSource({
            "Irene Villagers 1, Irene Villagers 2",
            "Irene Villagers 1, Irene Villagers",
            "Irene Villagers U15, Irene Villagers U13",
            "Irene Villagers U15, Irene Villagers",
            "Irene Villagers U15 2, Irene Villagers U15"})
    void aNumberOrAgeGroupNeverMatchesAnotherOrNone(String a, String b) {
        assertThat(TeamNameForms.compatible(a, b)).isFalse();
    }

    @Test
    void identicalNumbersAndAgeGroupsAreCompatible() {
        assertThat(TeamNameForms.compatible("Irene Villagers 1", "IRENE VILLAGERS 1")).isTrue();
        assertThat(TeamNameForms.compatible("Irene Villagers U15", "Irene Villagers Under 15")).isTrue();
    }

    @Test
    void closestPicksTheNearerSideForATypoOrAShorterName() {
        assertThat(TeamNameForms.closest("Pretoria Gymnasium", "Irene Villagers U15", "Pretoria Gymnasium A"))
                .get().extracting(TeamNameForms.Closest::side).isEqualTo(ResultSide.AWAY);
        assertThat(TeamNameForms.closest("Irene Vilagers U15", "Irene Villagers U15", "Pretoria A"))
                .get().extracting(TeamNameForms.Closest::side).isEqualTo(ResultSide.HOME);
    }

    @Test
    void closestSaysNothingWhenItCannotTellOrTheNumbersDiffer() {
        // equally close to both sides
        assertThat(TeamNameForms.closest("Villagers", "Irene Villagers", "Irene Villagers")).isEmpty();
        // alike but a different number: never a hint
        assertThat(TeamNameForms.closest("Irene Villagers 2", "Irene Villagers 1", "Pretoria A")).isEmpty();
        // nothing alike
        assertThat(TeamNameForms.closest("Riverside", "Irene Villagers U15", "Pretoria A")).isEmpty();
        assertThat(TeamNameForms.words(null)).isEqualTo(List.of());
    }
}
