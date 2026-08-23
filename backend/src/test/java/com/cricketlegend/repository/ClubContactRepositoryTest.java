package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubContact;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Contact;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration tests for ClubContactRepository — per docs/standards/backend.md, every custom
 * repository query ships a Testcontainers-backed integration test. Also proves
 * 013-add-club-contact.sql applies cleanly on top of 012 (implicit via context boot — this test
 * class only runs at all if the whole migration chain applied without error), and the DB-level
 * backstop that migration ships: the partial unique index {@code ux_club_contact_primary} rejects
 * two simultaneous active primaries for the same club, inserted directly via the repository
 * (bypassing ClubContactServiceImpl's own auto-unset), while explicitly allowing a deactivated
 * contact to carry a stale {@code isPrimary=true} alongside an active primary — proving the
 * partial {@code WHERE is_primary AND active} clause behaves as documented, not just as written.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class ClubContactRepositoryTest {

    @Autowired
    private ClubContactRepository clubContactRepository;

    @Autowired
    private ClubRepository clubRepository;

    private Club savedClub(String slug) {
        return clubRepository.save(Club.builder().name("Riverside CC").slug(slug).status(ClubStatus.ACTIVE).build());
    }

    private ClubContact contact(UUID clubId, boolean active, boolean primary) {
        return ClubContact.builder()
                .clubId(clubId)
                .contact(Contact.builder()
                        .firstName("Jane")
                        .lastName("Doe")
                        .email("jane@example.com")
                        .phone("0123456789")
                        .build())
                .role("Chairman")
                .active(active)
                .isPrimary(primary)
                .build();
    }

    @Test
    void uxClubContactPrimaryRejectsASecondSimultaneousActivePrimaryForTheSameClubAtTheDbLevel() {
        Club club = savedClub("riverside-cc");
        clubContactRepository.saveAndFlush(contact(club.getId(), true, true));

        ClubContact secondActivePrimary = contact(club.getId(), true, true);

        assertThatThrownBy(() -> clubContactRepository.saveAndFlush(secondActivePrimary))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void uxClubContactPrimaryAllowsAnInactivePrimaryAlongsideAnActivePrimaryForTheSameClub() {
        // The partial index's WHERE is_primary AND active clause means a deactivated contact's
        // stale isPrimary=true is never blocked by an active contact already holding the flag —
        // the documented carve-out, proven for real rather than just asserted in a Javadoc.
        Club club = savedClub("riverside-cc");
        clubContactRepository.saveAndFlush(contact(club.getId(), true, true));

        ClubContact inactivePrimary = contact(club.getId(), false, true);

        ClubContact saved = clubContactRepository.saveAndFlush(inactivePrimary);

        assertThat(saved.getId()).isNotNull();
        assertThat(clubContactRepository.findByClubId(club.getId())).hasSize(2);
    }

    @Test
    void findByClubIdReturnsOnlyContactsForThatClub() {
        Club clubX = savedClub("riverside-cc");
        Club clubY = savedClub("lakeside-cc");
        ClubContact contactForX = clubContactRepository.save(contact(clubX.getId(), true, false));
        clubContactRepository.save(contact(clubY.getId(), true, false));

        assertThat(clubContactRepository.findByClubId(clubX.getId()))
                .extracting(ClubContact::getId)
                .containsExactly(contactForX.getId());
    }

    @Test
    void findByClubIdAndActiveTrueAndIsPrimaryTrueExcludesInactiveAndNonPrimaryRows() {
        Club club = savedClub("riverside-cc");
        ClubContact activePrimary = clubContactRepository.save(contact(club.getId(), true, true));
        clubContactRepository.save(contact(club.getId(), true, false));
        clubContactRepository.save(contact(club.getId(), false, true));

        assertThat(clubContactRepository.findByClubIdAndActiveTrueAndIsPrimaryTrue(club.getId()))
                .extracting(ClubContact::getId)
                .containsExactly(activePrimary.getId());
    }
}
