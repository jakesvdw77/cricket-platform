package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Contact;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueContact;
import com.cricketlegend.domain.LeagueSource;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration tests for LeagueContactRepository — per docs/standards/backend.md, every custom
 * repository query ships a Testcontainers-backed integration test. Also proves
 * 030-add-league-contact.sql applies cleanly on top of 029 (implicit via context boot — this test
 * class only runs at all if the whole migration chain applied without error), and the DB-level
 * backstop that migration ships: the partial unique index {@code ux_league_contact_primary}
 * rejects two simultaneous active primaries for the same league, inserted directly via the
 * repository (bypassing LeagueContactServiceImpl's own auto-unset), while explicitly allowing a
 * deactivated contact to carry a stale {@code isPrimary=true} alongside an active primary — mirrors
 * SponsorContactRepositoryTest's own coverage, proven from the first version of this test, not
 * added after finding a bug.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class LeagueContactRepositoryTest {

    @Autowired
    private LeagueContactRepository leagueContactRepository;

    @Autowired
    private LeagueRepository leagueRepository;

    @Autowired
    private ClubRepository clubRepository;

    private League savedLeague(String clubSlug) {
        Club club = clubRepository.save(
                Club.builder().name("Riverside CC").slug(clubSlug).status(ClubStatus.ACTIVE).build());
        return leagueRepository.save(League.builder()
                .clubId(club.getId())
                .name("Premier League")
                .source(LeagueSource.INTERNAL)
                .maxPlayingXiSize(11)
                .active(true)
                .build());
    }

    private LeagueContact contact(UUID leagueId, boolean active, boolean primary) {
        return LeagueContact.builder()
                .leagueId(leagueId)
                .contact(Contact.builder()
                        .firstName("Jane")
                        .lastName("Doe")
                        .email("jane@example.com")
                        .phone("0123456789")
                        .build())
                .role("Umpire Coordinator")
                .active(active)
                .isPrimary(primary)
                .build();
    }

    @Test
    void uxLeagueContactPrimaryRejectsASecondSimultaneousActivePrimaryForTheSameLeagueAtTheDbLevel() {
        League league = savedLeague("riverside-cc");
        leagueContactRepository.saveAndFlush(contact(league.getId(), true, true));

        LeagueContact secondActivePrimary = contact(league.getId(), true, true);

        assertThatThrownBy(() -> leagueContactRepository.saveAndFlush(secondActivePrimary))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void uxLeagueContactPrimaryAllowsAnInactivePrimaryAlongsideAnActivePrimaryForTheSameLeague() {
        // The partial index's WHERE is_primary AND active clause means a deactivated contact's
        // stale isPrimary=true is never blocked by an active contact already holding the flag —
        // the documented carve-out, proven for real rather than just asserted in a Javadoc.
        League league = savedLeague("riverside-cc");
        leagueContactRepository.saveAndFlush(contact(league.getId(), true, true));

        LeagueContact inactivePrimary = contact(league.getId(), false, true);

        LeagueContact saved = leagueContactRepository.saveAndFlush(inactivePrimary);

        assertThat(saved.getId()).isNotNull();
        assertThat(leagueContactRepository.findByLeagueId(league.getId())).hasSize(2);
    }

    @Test
    void findByLeagueIdReturnsOnlyContactsForThatLeague() {
        League leagueX = savedLeague("riverside-cc");
        League leagueY = savedLeague("lakeside-cc");
        LeagueContact contactForX = leagueContactRepository.save(contact(leagueX.getId(), true, false));
        leagueContactRepository.save(contact(leagueY.getId(), true, false));

        assertThat(leagueContactRepository.findByLeagueId(leagueX.getId()))
                .extracting(LeagueContact::getId)
                .containsExactly(contactForX.getId());
    }

    @Test
    void findByLeagueIdAndActiveTrueAndIsPrimaryTrueExcludesInactiveAndNonPrimaryRows() {
        League league = savedLeague("riverside-cc");
        LeagueContact activePrimary = leagueContactRepository.save(contact(league.getId(), true, true));
        leagueContactRepository.save(contact(league.getId(), true, false));
        leagueContactRepository.save(contact(league.getId(), false, true));

        assertThat(leagueContactRepository.findByLeagueIdAndActiveTrueAndIsPrimaryTrue(league.getId()))
                .extracting(LeagueContact::getId)
                .containsExactly(activePrimary.getId());
    }
}
