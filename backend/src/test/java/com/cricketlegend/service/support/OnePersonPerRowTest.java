package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** docs/specs/104: the collision rule, one person per row in one list. Invented names only. */
class OnePersonPerRowTest {

    private static final NameCandidate ABEL = new NameCandidate(UUID.randomUUID(), "Abel", "Nazar");
    private static final NameCandidate CEES = new NameCandidate(UUID.randomUUID(), "Cees", "Meyer");

    private static NameResolution linked(String written, NameCandidate candidate) {
        return NameResolution.matched(written, NameLevel.NORMALISED, NameReason.INITIALS, candidate);
    }

    @Test
    void aSecondDifferentSpellingOfTheSamePlayerBecomesAGuestWithACollision() {
        List<NameResolution> out = OnePersonPerRow.apply(List.of(linked("Nazar A", ABEL), linked("A Nazar", ABEL)));

        assertThat(out.get(0).candidate()).isEqualTo(ABEL);
        assertThat(out.get(1).level()).isEqualTo(NameLevel.UNRESOLVED);
        assertThat(out.get(1).reason()).isEqualTo(NameReason.COLLISION);
        assertThat(out.get(1).candidate()).isNull();
        assertThat(out.get(1).alternatives()).containsExactly(ABEL);
    }

    @Test
    void theFirstRowInFileOrderKeepsTheLink() {
        List<NameResolution> out = OnePersonPerRow.apply(List.of(linked("A Nazar", ABEL), linked("Nazar A", ABEL)));

        assertThat(out.get(0).isLinked()).isTrue();
        assertThat(out.get(1).reason()).isEqualTo(NameReason.COLLISION);
    }

    @Test
    void theSameSpellingTwiceIsTheSamePersonAndIsLeftAlone() {
        List<NameResolution> out = OnePersonPerRow.apply(List.of(linked("Nazar A", ABEL), linked("Nazar A", ABEL)));

        assertThat(out).allSatisfy(r -> assertThat(r.isLinked()).isTrue());
    }

    @Test
    void spellingsThatDifferOnlyByCaseAndSpacingAreTheSameSpelling() {
        List<NameResolution> out = OnePersonPerRow.apply(List.of(linked("Nazar A", ABEL), linked("nazar  a", ABEL)));

        assertThat(out).allSatisfy(r -> assertThat(r.isLinked()).isTrue());
    }

    @Test
    void differentPlayersAndUnlinkedRowsAreUntouched() {
        NameResolution unresolved = NameResolution.unresolved("Zane Quirk", NameReason.NO_MATCH, List.of());
        List<NameResolution> in = List.of(linked("Nazar A", ABEL), linked("Meyer C", CEES), unresolved);

        List<NameResolution> out = OnePersonPerRow.apply(in);

        assertThat(out).containsExactlyElementsOf(in);
    }

    @Test
    void aCollidedRowKeepsItsSuggestions() {
        NameResolution withSuggestions = linked("A Nazar", ABEL).withSuggestions(List.of(new NameSuggestion(CEES, 0.9)));

        List<NameResolution> out = OnePersonPerRow.apply(List.of(linked("Nazar A", ABEL), withSuggestions));

        assertThat(out.get(1).suggestions()).hasSize(1);
    }
}
