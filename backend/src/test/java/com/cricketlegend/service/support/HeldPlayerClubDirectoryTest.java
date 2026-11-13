package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PlayerProfile;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/** Unit tests for docs/specs/148 Decision 2: who may see the club contact directory. */
class HeldPlayerClubDirectoryTest {

    private static final LocalDate ADULT = LocalDate.now().minusYears(30);
    private static final LocalDate JUNIOR = LocalDate.now().minusYears(12);

    private static HeldPlayer self(LocalDate dob) {
        Person me = Person.builder().firstName("Me").lastName("Player").dateOfBirth(dob).build();
        return new HeldPlayer("self:1", me, me, PlayerProfile.builder().build(), null);
    }

    private static HeldPlayer linked(boolean main) {
        Person caller = Person.builder().firstName("Pat").lastName("Parent").build();
        Person kid = Person.builder().firstName("Sam").lastName("Smith").dateOfBirth(JUNIOR).build();
        return new HeldPlayer("link", caller, kid, PlayerProfile.builder().build(), PersonLink.builder().main(main).build());
    }

    @Test
    void anAdultPlayersOwnRecordSeesTheDirectory() {
        assertThat(self(ADULT).canSeeClubDirectory()).isTrue();
    }

    @Test
    void aJuniorsOwnLoginDoesNotSeeTheDirectory() {
        assertThat(self(JUNIOR).canSeeClubDirectory()).isFalse();
    }

    @Test
    void anOwnRecordWithNoDateOfBirthCountsAsAdult() {
        assertThat(self(null).canSeeClubDirectory()).isTrue();
    }

    @Test
    void aLinkedMainAccountSeesTheDirectory() {
        assertThat(linked(true).canSeeClubDirectory()).isTrue();
    }

    @Test
    void aLinkedNonMainAccountSeesTheDirectory() {
        assertThat(linked(false).canSeeClubDirectory()).isTrue();
    }

    @Test
    void canEditMedicalIsUnchanged() {
        assertThat(self(ADULT).canEditMedical()).isTrue();
        assertThat(self(null).canEditMedical()).isTrue();
        assertThat(self(JUNIOR).canEditMedical()).isFalse();
        assertThat(linked(true).canEditMedical()).isTrue();
        assertThat(linked(false).canEditMedical()).isFalse();
    }
}
