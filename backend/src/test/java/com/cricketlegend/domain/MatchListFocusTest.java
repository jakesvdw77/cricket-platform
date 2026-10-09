package com.cricketlegend.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.exception.ValidationException;
import org.junit.jupiter.api.Test;

/** docs/specs/087-matches-polls-alignment.md: the {@code focus} request value. */
class MatchListFocusTest {

    @Test
    void parsesEachValueInAnyCaseAndIgnoringSurroundingBlanks() {
        assertThat(MatchListFocus.parse("this-week")).isEqualTo(MatchListFocus.THIS_WEEK);
        assertThat(MatchListFocus.parse("Not-Announced")).isEqualTo(MatchListFocus.NOT_ANNOUNCED);
        assertThat(MatchListFocus.parse("  NO-POLL ")).isEqualTo(MatchListFocus.NO_POLL);
    }

    @Test
    void aMissingOrBlankValueMeansNoFocus() {
        assertThat(MatchListFocus.parse(null)).isNull();
        assertThat(MatchListFocus.parse("")).isNull();
        assertThat(MatchListFocus.parse("   ")).isNull();
    }

    @Test
    void anythingElseIsAValidationError() {
        assertThatThrownBy(() -> MatchListFocus.parse("everything")).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> MatchListFocus.parse("this_week")).isInstanceOf(ValidationException.class);
    }

    @Test
    void theRequestValuesRoundTrip() {
        for (MatchListFocus focus : MatchListFocus.values()) {
            assertThat(MatchListFocus.parse(focus.value())).isEqualTo(focus);
        }
    }
}
