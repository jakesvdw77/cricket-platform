package com.cricketlegend.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.exception.ValidationException;
import org.junit.jupiter.api.Test;

/** docs/specs/088-players-polls-alignment.md: the {@code focus} request value of the players list. */
class PlayerListFocusTest {

    @Test
    void parsesEachValueInAnyCaseAndIgnoringSurroundingBlanks() {
        assertThat(PlayerListFocus.parse("in-squad")).isEqualTo(PlayerListFocus.IN_SQUAD);
        assertThat(PlayerListFocus.parse("Selected")).isEqualTo(PlayerListFocus.SELECTED);
        assertThat(PlayerListFocus.parse("  UNVERIFIED ")).isEqualTo(PlayerListFocus.UNVERIFIED);
    }

    @Test
    void aMissingOrBlankValueMeansNoFocus() {
        assertThat(PlayerListFocus.parse(null)).isNull();
        assertThat(PlayerListFocus.parse("")).isNull();
        assertThat(PlayerListFocus.parse("  ")).isNull();
    }

    @Test
    void anythingElseIsAValidationError() {
        assertThatThrownBy(() -> PlayerListFocus.parse("everyone")).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> PlayerListFocus.parse("in_squad")).isInstanceOf(ValidationException.class);
    }

    @Test
    void onlyTheTwoSeasonFocusesNeedASeason() {
        assertThat(PlayerListFocus.IN_SQUAD.needsSeason()).isTrue();
        assertThat(PlayerListFocus.SELECTED.needsSeason()).isTrue();
        assertThat(PlayerListFocus.UNVERIFIED.needsSeason()).isFalse();
    }

    @Test
    void theRequestValuesRoundTrip() {
        for (PlayerListFocus focus : PlayerListFocus.values()) {
            assertThat(PlayerListFocus.parse(focus.value())).isEqualTo(focus);
        }
    }
}
