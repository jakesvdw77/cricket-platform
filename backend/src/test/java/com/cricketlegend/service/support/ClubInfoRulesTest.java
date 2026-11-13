package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Unit tests for docs/specs/148-player-hub-club-info.md's pure Club info rules. */
class ClubInfoRulesTest {

    @Test
    void httpsUrlKeepsOnlyWellFormedHttpsUrlsWithAHost() {
        assertThat(ClubInfoRules.httpsUrl("https://club.example.com/path")).isEqualTo("https://club.example.com/path");
        assertThat(ClubInfoRules.httpsUrl("  HTTPS://club.example.com  ")).isEqualTo("HTTPS://club.example.com");
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://club.example.com", "javascript:alert(1)", "ftp://x.example.com", "https://", "https:///nohost",
            "club.example.com", "https://bad host.example.com", "", "   "})
    void httpsUrlRejectsEverythingElse(String url) {
        assertThat(ClubInfoRules.httpsUrl(url)).isNull();
    }

    @Test
    void httpsUrlOfNullIsNull() {
        assertThat(ClubInfoRules.httpsUrl(null)).isNull();
    }

    @Test
    void blankToNullTrimsAndTurnsBlankIntoNull() {
        assertThat(ClubInfoRules.blankToNull(null)).isNull();
        assertThat(ClubInfoRules.blankToNull("")).isNull();
        assertThat(ClubInfoRules.blankToNull("  \t ")).isNull();
        assertThat(ClubInfoRules.blankToNull("  Hello ")).isEqualTo("Hello");
    }

    @Test
    void likePatternMatchesEverythingForANullOrBlankQuery() {
        assertThat(ClubInfoRules.likePattern(null)).isEqualTo("%");
        assertThat(ClubInfoRules.likePattern("   ")).isEqualTo("%");
    }

    @Test
    void likePatternIsLowerCaseTrimmedAndContains() {
        assertThat(ClubInfoRules.likePattern("  SmItH ")).isEqualTo("%smith%");
    }

    @Test
    void likePatternEscapesPercentUnderscoreAndTheEscapeCharacterWithBang() {
        assertThat(ClubInfoRules.likePattern("50%")).isEqualTo("%50!%%");
        assertThat(ClubInfoRules.likePattern("a_b")).isEqualTo("%a!_b%");
        assertThat(ClubInfoRules.likePattern("hey!")).isEqualTo("%hey!!%");
        assertThat(ClubInfoRules.likePattern("%_!")).isEqualTo("%!%!_!!%");
    }

    @ParameterizedTest
    @ValueSource(strings = {"A", "M", "Z", "#"})
    void isLetterFilterAcceptsOneUpperCaseLetterOrHash(String letter) {
        assertThat(ClubInfoRules.isLetterFilter(letter)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "AB", "a", "z", "1", "%", "_", "##", " ", "Á"})
    void isLetterFilterRejectsEverythingElse(String letter) {
        assertThat(ClubInfoRules.isLetterFilter(letter)).isFalse();
    }

    @Test
    void isLetterFilterRejectsNull() {
        assertThat(ClubInfoRules.isLetterFilter(null)).isFalse();
    }

    @Test
    void sortedLettersAreAToZThenHashAndDistinct() {
        assertThat(ClubInfoRules.sortedLetters(List.of("S", "#", "A", "M", "A", "B"))).containsExactly("A", "B", "M", "S", "#");
        assertThat(ClubInfoRules.sortedLetters(Set.of("#"))).containsExactly("#");
        assertThat(ClubInfoRules.sortedLetters(List.of())).isEmpty();
    }
}
