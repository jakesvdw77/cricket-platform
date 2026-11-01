package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class PlayerDisplayNameTest {

    @Test
    void initialsKeepTheSurname() {
        assertThat(PlayerDisplayName.of("Mandla", "Naidoo", true)).isEqualTo("M. Naidoo");
        assertThat(PlayerDisplayName.of("Mandla", "Naidoo", false)).isEqualTo("Mandla Naidoo");
        assertThat(PlayerDisplayName.of(null, "Naidoo", true)).isEqualTo("N.");
        assertThat(PlayerDisplayName.of(" ", null, false)).isEmpty();
    }

    @Test
    void juniorIsUnderEighteenAndMissingDobIsAdult() {
        LocalDate today = LocalDate.of(2026, 11, 2);
        assertThat(PlayerDisplayName.isJunior(LocalDate.of(2008, 11, 3), today)).isTrue();
        assertThat(PlayerDisplayName.isJunior(LocalDate.of(2008, 11, 2), today)).isFalse();
        assertThat(PlayerDisplayName.isJunior(null, today)).isFalse();
    }
}
