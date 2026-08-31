package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration tests for PlayerProfileRepository — per docs/standards/backend.md, every custom
 * repository query ships a Testcontainers-backed integration test. Also proves
 * 020-add-player.sql applies cleanly on top of 001-019 (implicit via context boot — this test
 * class only runs at all if the whole migration chain applied without error, including the
 * {@code person.email} nullability change), and that the {@code UNIQUE (person_id, club_id)}
 * constraint genuinely rejects a duplicate pair at the DB level, bypassing the service layer
 * entirely.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class PlayerProfileRepositoryTest {

    @Autowired
    private PlayerProfileRepository playerProfileRepository;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private PersonRepository personRepository;

    private Club savedClub(String slug) {
        return clubRepository.save(
                Club.builder().name("Riverside CC").slug(slug).status(ClubStatus.ACTIVE).build());
    }

    private Person savedPerson() {
        return personRepository.save(Person.builder().firstName("Jane").lastName("Doe").build());
    }

    private PlayerProfile playerProfile(UUID personId, UUID clubId) {
        return PlayerProfile.builder().personId(personId).clubId(clubId).active(true).build();
    }

    @Test
    void findByClubIdReturnsOnlyPlayersForThatClub() {
        Club clubA = savedClub("riverside-cc");
        Club clubB = savedClub("lakeside-cc");
        Person personA = savedPerson();
        Person personB = savedPerson();
        PlayerProfile playerA =
                playerProfileRepository.save(playerProfile(personA.getId(), clubA.getId()));
        playerProfileRepository.save(playerProfile(personB.getId(), clubB.getId()));

        assertThat(playerProfileRepository.findByClubId(clubA.getId()))
                .extracting(PlayerProfile::getId)
                .containsExactly(playerA.getId());
    }

    @Test
    void uniqueConstraintRejectsADuplicatePersonAndClubPairAtTheDbLevel() {
        Club club = savedClub("riverside-cc");
        Person person = savedPerson();
        playerProfileRepository.save(playerProfile(person.getId(), club.getId()));

        PlayerProfile duplicate = playerProfile(person.getId(), club.getId());

        assertThatThrownBy(() -> playerProfileRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void aPersonCanHaveASeparatePlayerProfilePerDifferentClub() {
        Club clubA = savedClub("riverside-cc");
        Club clubB = savedClub("lakeside-cc");
        Person person = savedPerson();
        playerProfileRepository.save(playerProfile(person.getId(), clubA.getId()));

        PlayerProfile secondClubProfile = playerProfileRepository.saveAndFlush(
                playerProfile(person.getId(), clubB.getId()));

        assertThat(secondClubProfile.getId()).isNotNull();
    }
}
