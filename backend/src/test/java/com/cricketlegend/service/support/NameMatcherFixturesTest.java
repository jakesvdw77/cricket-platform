package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * docs/specs/104-match-results-import-adaptors.md Test Plan, "Processor, deterministic matching": a fixtures table of
 * file spelling, candidate list, expected level, reason and result, run through {@link NameResolver} (tiers 1 to 3
 * then the tier 4 suggestions). Every name is invented. A candidate is written {@code "given names|surname"}; the
 * expected result is the candidate's full name, or null when nothing may be linked.
 */
class NameMatcherFixturesTest {

    private record Fixture(
            String label, String written, List<String> pool, NameLevel level, NameReason reason, String linked) {
        @Override
        public String toString() {
            return label + ": '" + written + "'";
        }
    }

    private static Fixture linked(String label, String written, String pool, NameLevel level, NameReason reason, String expected) {
        return new Fixture(label, written, List.of(pool.split(";")), level, reason, expected);
    }

    private static Fixture unplaced(String label, String written, String pool, NameReason reason) {
        return new Fixture(label, written, List.of(pool.split(";")), NameLevel.UNRESOLVED, reason, null);
    }

    private static List<NameCandidate> candidates(List<String> pool) {
        return pool.stream().map(entry -> {
            String[] parts = entry.split("\\|");
            return new NameCandidate(UUID.nameUUIDFromBytes(entry.getBytes()), parts[0], parts[1]);
        }).toList();
    }

    static Stream<Fixture> fixtures() {
        String abel = "Abel|Nazar";
        String abelBruce = "Abel Bruce|Nazar";
        String jack = "Jack|van der Walton";
        return Stream.of(
                // tier 1
                linked("tier 1 identity", "Abel Nazar", abel, NameLevel.EXACT, NameReason.EXACT, "Abel Nazar"),
                linked("tier 1 trimmed", "  Abel Nazar ", abel, NameLevel.EXACT, NameReason.EXACT, "Abel Nazar"),

                // EXACT level, NORMALISED_EXACT: case, accents, spacing, hyphen, apostrophe, particle forms
                linked("case", "abel NAZAR", abel, NameLevel.EXACT, NameReason.NORMALISED_EXACT, "Abel Nazar"),
                linked("spacing", "Abel    Nazar", abel, NameLevel.EXACT, NameReason.NORMALISED_EXACT, "Abel Nazar"),
                linked("accents", "Ábel Názar", abel, NameLevel.EXACT, NameReason.NORMALISED_EXACT, "Abel Nazar"),
                linked("hyphen", "Mary-Anne Cole", "Mary Anne|Cole", NameLevel.EXACT, NameReason.NORMALISED_EXACT, "Mary Anne Cole"),
                linked("apostrophe", "Pat O'Brien", "Pat|OBrien", NameLevel.EXACT, NameReason.NORMALISED_EXACT, "Pat OBrien"),
                linked("particle vd for van der", "Jack Vd Walton", jack, NameLevel.EXACT, NameReason.NORMALISED_EXACT, "Jack van der Walton"),
                linked("particle Van Der capitalised", "Jack Van Der Walton", jack, NameLevel.EXACT, NameReason.NORMALISED_EXACT, "Jack van der Walton"),
                linked("particle van den for van der", "Eric Van Den Merton", "Eric|van der Merton", NameLevel.EXACT, NameReason.NORMALISED_EXACT, "Eric van der Merton"),
                linked("particle de capitalised", "Adam De Vries", "Adam|de Vries", NameLevel.EXACT, NameReason.NORMALISED_EXACT, "Adam de Vries"),
                linked("particle written closed up", "Jack VanDerWalton", jack, NameLevel.EXACT, NameReason.NORMALISED_EXACT, "Jack van der Walton"),
                linked("full given name with abbreviated particle surname", "Sam vdW", "Sam|van der Walton", NameLevel.EXACT, NameReason.NORMALISED_EXACT, "Sam van der Walton"),

                // tier 2, NORMALISED: word order and a dropped particle are guesses
                linked("word order, full names", "Nazar Abel", abel, NameLevel.NORMALISED, NameReason.NORMALISED, "Abel Nazar"),
                linked("dropped particle", "Adam Vries", "Adam|de Vries", NameLevel.NORMALISED, NameReason.NORMALISED, "Adam de Vries"),

                // tier 3: initials and prefixes
                linked("surname then initial", "Nazar A", abel, NameLevel.NORMALISED, NameReason.INITIALS, "Abel Nazar"),
                linked("initial then surname", "A Nazar", abel, NameLevel.NORMALISED, NameReason.INITIALS, "Abel Nazar"),
                linked("initial with a dot", "A. Nazar", abel, NameLevel.NORMALISED, NameReason.INITIALS, "Abel Nazar"),
                linked("two initials", "AB Nazar", abelBruce, NameLevel.NORMALISED, NameReason.INITIALS, "Abel Bruce Nazar"),
                linked("one initial of two given names", "A Nazar", abelBruce, NameLevel.NORMALISED, NameReason.INITIALS, "Abel Bruce Nazar"),
                linked("mixed-case initials", "Cd Bright", "Cornelis Dirk|Bright", NameLevel.NORMALISED, NameReason.INITIALS, "Cornelis Dirk Bright"),
                linked("start of the given name", "Ab Nazar", "Abel|Nazar;Adam|Nazar", NameLevel.NORMALISED, NameReason.INITIALS, "Abel Nazar"),
                linked("abbreviated particle surname", "vdW", jack, NameLevel.NORMALISED, NameReason.ABBREVIATED_SURNAME, "Jack van der Walton"),
                linked("abbreviated particle surname with an initial", "J vdW", jack, NameLevel.NORMALISED, NameReason.ABBREVIATED_SURNAME, "Jack van der Walton"),
                linked("surname prefix", "Vermeul", "Pieter|Vermeulen", NameLevel.NORMALISED, NameReason.SURNAME_PREFIX, "Pieter Vermeulen"),
                linked("surname prefix with an initial", "P Vermeul", "Pieter|Vermeulen", NameLevel.NORMALISED, NameReason.SURNAME_PREFIX, "Pieter Vermeulen"),
                linked("given name and surname initial", "Sol V", "Sol|Varga", NameLevel.NORMALISED, NameReason.SURNAME_INITIAL, "Sol Varga"),
                linked("given name and two surname letters", "Sol Va", "Sol|Varga", NameLevel.NORMALISED, NameReason.SURNAME_INITIAL, "Sol Varga"),
                linked("given name and particle initial", "Walter V", "Walter|Van Der Nell", NameLevel.NORMALISED, NameReason.SURNAME_INITIAL, "Walter Van Der Nell"),
                linked("a candidate listed twice counts once", "A Nazar", abel + ";" + abel, NameLevel.NORMALISED, NameReason.INITIALS, "Abel Nazar"),

                // ambiguity: two candidates fit, nothing is linked
                unplaced("initial fits two", "A Nazar", "Abel|Nazar;Adam|Nazar", NameReason.AMBIGUOUS),
                unplaced("surname prefix fits two", "Vermeul", "Pieter|Vermeulen;Hans|Vermeulen", NameReason.AMBIGUOUS),
                unplaced("given name and surname initial fits two", "Sol V", "Sol|Varga;Sol|Verga", NameReason.AMBIGUOUS),

                // disagreeing initials and unknown names
                unplaced("initials that disagree", "B Nazar", abel, NameReason.NO_MATCH),
                unplaced("more initials than given names", "AB Nazar", abel, NameReason.NO_MATCH),
                unplaced("surname prefix too short", "Ve", "Pieter|Vermeulen", NameReason.NO_MATCH),
                unplaced("a name outside the candidate set", "Zane Quirk", abel + ";Cees|Meyer", NameReason.NO_MATCH),
                unplaced("nobody to match", "Abel Nazar", "Pat|Jones", NameReason.NO_MATCH),
                unplaced("blank", "   ", abel, NameReason.NO_MATCH),
                unplaced("punctuation only", "...", abel, NameReason.NO_MATCH));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("fixtures")
    void resolvesToTheExpectedLevelReasonAndCandidate(Fixture fixture) {
        NameResolution resolution = NameResolver.resolve(fixture.written(), candidates(fixture.pool()));

        assertThat(resolution.level()).isEqualTo(fixture.level());
        assertThat(resolution.reason()).isEqualTo(fixture.reason());
        if (fixture.linked() == null) {
            assertThat(resolution.isLinked()).isFalse();
            assertThat(resolution.candidate()).isNull();
        } else {
            assertThat(resolution.candidate().fullName()).isEqualTo(fixture.linked());
        }
    }

    @Test
    void anAmbiguousNameNamesBothCandidates() {
        NameResolution resolution = NameResolver.resolve("A Nazar",
                candidates(List.of("Abel|Nazar", "Adam|Nazar", "Pat|Jones")));

        assertThat(resolution.alternatives()).extracting(NameCandidate::fullName)
                .containsExactlyInAnyOrder("Abel Nazar", "Adam Nazar");
    }

    @Test
    void onlyTiersOneToThreeEverLinkAndTierFourNeverDoes() {
        // Hank Brown -> Hank Brow is a typo: close enough to suggest, never close enough to link
        NameResolution resolution = NameResolver.resolve("Hank Brown", candidates(List.of("Hank|Brow")));

        assertThat(resolution.isLinked()).isFalse();
        assertThat(resolution.level()).isEqualTo(NameLevel.UNRESOLVED);
        assertThat(resolution.reason()).isEqualTo(NameReason.NO_MATCH);
        assertThat(resolution.suggestions()).singleElement().satisfies(s -> {
            assertThat(s.candidate().fullName()).isEqualTo("Hank Brow");
            assertThat(s.score()).isGreaterThanOrEqualTo(NameSimilarity.MIN_SCORE);
        });
    }

    @Test
    void aLinkedNameCarriesNoSuggestions() {
        assertThat(NameResolver.resolve("Abel Nazar", candidates(List.of("Abel|Nazar", "Abel|Nazer"))).suggestions()).isEmpty();
    }

    @Test
    void aDissimilarNameHasNoSuggestionAtAll() {
        NameResolution resolution = NameResolver.resolve("Zane Quirk", candidates(List.of("Abel|Nazar", "Cees|Meyer")));

        assertThat(resolution.suggestions()).isEmpty();
    }

    // ---- tier 4 on its own ----

    @Test
    void suggestionsAreRankedBestFirstAndCapped() {
        List<NameCandidate> pool = candidates(List.of(
                "Pieter|Bright", "Peter|Bright", "Peter|Brights", "Peter|Brightt", "Zane|Quirk"));

        List<NameSuggestion> ranked = NameSimilarity.rank("Peter Brighd", pool);

        assertThat(ranked).hasSize(NameSimilarity.MAX_SUGGESTIONS).hasSize(3);
        assertThat(ranked).extracting(s -> s.score()).isSortedAccordingTo(java.util.Comparator.reverseOrder());
        assertThat(ranked.get(0).candidate().fullName()).isEqualTo("Peter Bright");
        assertThat(ranked).extracting(s -> s.candidate().fullName()).doesNotContain("Zane Quirk");
        assertThat(ranked).allSatisfy(s -> assertThat(s.score()).isGreaterThanOrEqualTo(0.80));
    }

    @Test
    void equalScoresAreOrderedByName() {
        List<NameSuggestion> ranked = NameSimilarity.rank("Peter Brighd",
                candidates(List.of("Peter|Brighz", "Peter|Bright", "Peter|Brighy")));

        assertThat(ranked).extracting(s -> s.candidate().fullName())
                .containsExactly("Peter Bright", "Peter Brighy", "Peter Brighz");
    }

    @Test
    void justAboveTheThresholdIsListedAndWellBelowIsNot() {
        // 'hankbrown' against 'hankbrow': one edit in nine letters (score 0.89)
        assertThat(NameSimilarity.rank("Hank Brown", candidates(List.of("Hank|Brow")))).hasSize(1);
        // three edits in thirteen letters (score 0.77) is under the threshold
        assertThat(NameSimilarity.rank("Hank Brownson", candidates(List.of("Hank|Brow")))).isEmpty();
        assertThat(NameSimilarity.MIN_SCORE).isEqualTo(0.80);
    }

    /**
     * KNOWN BUG (see the test report): the threshold is documented as "at or above 0.80" but the allowed edit count is
     * {@code floor((1 - 0.80) * length)} and {@code 1 - 0.80} is 0.19999999999999996 in floating point, so a form of 5, 10
     * or 15 letters loses an edit it should keep. Two edits in ten letters (score exactly 0.80) is not suggested.
     */
    @Test
    void aScoreExactlyAtTheThresholdIsListed() {
        // 'hankbrowns' against 'hankbrow': two edits in ten letters, 0.80
        assertThat(NameSimilarity.rank("Hank Browns", candidates(List.of("Hank|Brow")))).hasSize(1);
    }

    @Test
    void aFormUnderFiveLettersIsNeverSuggested() {
        // four letters, one typo: too short to trust
        assertThat(NameSimilarity.rank("Al Bo", candidates(List.of("Al|Bi")))).isEmpty();
    }

    @Test
    void aBlankNameHasNoSuggestions() {
        assertThat(NameSimilarity.rank("  ", candidates(List.of("Abel|Nazar")))).isEmpty();
    }

    @Test
    void aSurnameOnlySpellingIsComparedWithSurnamesOnly() {
        List<NameSuggestion> ranked = NameSimilarity.rank("Nazarr", candidates(List.of("Abel|Nazar", "Cees|Meyer")));

        assertThat(ranked).extracting(s -> s.candidate().fullName()).containsExactly("Abel Nazar");
    }

    @Test
    void aWordOrderSwappedTypoStillSuggests() {
        List<NameSuggestion> ranked = NameSimilarity.rank("Brighd Peter", candidates(List.of("Peter|Bright")));

        assertThat(ranked).extracting(s -> s.candidate().fullName()).containsExactly("Peter Bright");
    }

    @Test
    void theStrongestTierWinsWhenSeveralWouldFit() {
        // the exact spelling is found at tier 1 even though a near name would also be a suggestion
        NameResolution resolution = NameResolver.resolve("Peter Bright", candidates(List.of("Peter|Bright", "Peter|Brights")));

        assertThat(resolution.reason()).isEqualTo(NameReason.EXACT);
        assertThat(Arrays.asList(resolution.candidate().fullName())).containsExactly("Peter Bright");
    }
}
