package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Unit tests for the lenient name rules of docs/specs/077 (canonical form, particles, typo tolerance). */
class PlayerNameMatcherTest {

    private static boolean matches(String typedFirst, String typedLast, String storedFirst, String storedLast) {
        return PlayerNameMatcher.matches(typedFirst, typedLast, storedFirst, storedLast);
    }

    @Test
    void canonicalLowercasesStripsAccentsAndSeparators() {
        assertThat(PlayerNameMatcher.canonical("  Émile ")).isEqualTo("emile");
        assertThat(PlayerNameMatcher.canonical("Mary-Jane O'Neil.")).isEqualTo("maryjaneoneil");
        assertThat(PlayerNameMatcher.canonical("Mary’Jane")).isEqualTo("maryjane");
        assertThat(PlayerNameMatcher.canonical(null)).isEmpty();
    }

    @Test
    void surnameParticleVariantsAllReduceToTheBareSurname() {
        for (String variant : new String[] {
            "van der Westhuizen", "vanderwesthuizen", "vdwesthuizen", "vd Westhuizen", "v.d. Westhuizen",
            "Westhuizen", "VAN  DER  WESTHUIZEN"}) {
            assertThat(PlayerNameMatcher.canonicalSurname(variant)).as(variant).isEqualTo("westhuizen");
        }
    }

    @Test
    void particleIsKeptWhenNothingWouldRemain() {
        assertThat(PlayerNameMatcher.canonicalSurname("Van")).isEqualTo("van");
    }

    @Test
    void spacingCaseAndParticleVariantsMatch() {
        assertThat(matches("Jaco", "van der Westhuizen", "Jaco", "van der Westhuizen")).isTrue();
        assertThat(matches("jaco ", "VanderWesthuizen", "Jaco", "van der Westhuizen")).isTrue();
        assertThat(matches("Jaco", "v.d. Westhuizen", "Jaco", "van der Westhuizen")).isTrue();
        assertThat(matches("Jaco", "Westhuizen", "Jaco", "van der Westhuizen")).isTrue();
        assertThat(matches("Jaco", "Van Der Westhuizen", "Jaco", "Westhuizen")).isTrue();
    }

    @Test
    void accentsAreIgnored() {
        assertThat(matches("Emile", "Smit", "Émile", "Smit")).isTrue();
        assertThat(matches("Émile", "Smit", "Emile", "Smit")).isTrue();
    }

    @Test
    void aSmallTypoIsTolerated() {
        assertThat(matches("Jaco", "Wessthuizen", "Jaco", "van der Westhuizen")).isTrue();
        assertThat(matches("Jacob", "Westhuizen", "Jaco", "Westhuizen")).isFalse(); // 4 chars: exact only
    }

    @Test
    void aClearlyDifferentNameDoesNotMatch() {
        assertThat(matches("Jaco", "Smith", "Jaco", "van der Westhuizen")).isFalse();
        assertThat(matches("Pieter", "Westhuizen", "Jaco", "Westhuizen")).isFalse();
    }

    @Test
    void shortNamesStayExact() {
        assertThat(matches("Liam", "Jones", "Lian", "Jones")).isFalse();
        assertThat(matches("Liam", "Jones", "Liam", "Jones")).isTrue();
        assertThat(matches("Liam", "Ng", "Liam", "Nk")).isFalse();
    }

    @Test
    void toleranceGrowsWithLength() {
        assertThat(PlayerNameMatcher.withinTolerance("johnson", "johnsen")).isTrue(); // 7 chars, distance 1
        assertThat(PlayerNameMatcher.withinTolerance("johnson", "johnsun" + "x")).isFalse(); // distance 2 at 7
        assertThat(PlayerNameMatcher.withinTolerance("westhuizenx", "westhuizxnx")).isTrue();
        assertThat(PlayerNameMatcher.withinTolerance("abcdefghijk", "abcdefghxjz")).isTrue(); // 11 chars, distance 2
        assertThat(PlayerNameMatcher.withinTolerance("abcdefghijk", "abcdefgxxxk")).isFalse(); // distance 3
    }

    @Test
    void emptyNamesNeverMatch() {
        assertThat(matches("", "", "Jaco", "Smith")).isFalse();
        assertThat(PlayerNameMatcher.withinTolerance("", "")).isFalse();
    }

    @Test
    void lockFormSharesSpellingVariantsButNotTypos() {
        String base = PlayerNameMatcher.lockForm("Jaco", "van der Westhuizen");
        assertThat(PlayerNameMatcher.lockForm(" JACO", "VanderWesthuizen")).isEqualTo(base);
        assertThat(PlayerNameMatcher.lockForm("jaco", "v.d. Westhuizen")).isEqualTo(base);
        assertThat(PlayerNameMatcher.lockForm("Jaco", "Westhuizen")).isEqualTo(base);
        assertThat(PlayerNameMatcher.lockForm("Jaco", "Wessthuizen")).isNotEqualTo(base);
    }
}
