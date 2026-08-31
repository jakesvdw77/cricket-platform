package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubMembership;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Person;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration tests for ClubMembershipRepository — per docs/standards/backend.md, every custom
 * repository query ships a Testcontainers-backed integration test. Also proves
 * 020-add-player.sql's {@code club_membership} table applies cleanly (implicit via context boot),
 * that {@link ClubMembership#getValidFrom()} defaults via {@code @PrePersist} when unset, and
 * that the partial unique index {@code ux_club_membership_active} genuinely rejects a second
 * {@code valid_to IS NULL} row for the same person at the DB level, bypassing the service layer
 * entirely.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class ClubMembershipRepositoryTest {

    @Autowired
    private ClubMembershipRepository clubMembershipRepository;

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

    @Test
    void findByPersonIdAndValidToIsNullReturnsOnlyTheCurrentlyActiveMembership() {
        Club club = savedClub("riverside-cc");
        Person person = savedPerson();
        ClubMembership active = clubMembershipRepository.save(ClubMembership.builder()
                .personId(person.getId())
                .clubId(club.getId())
                .build());

        assertThat(clubMembershipRepository.findByPersonIdAndValidToIsNull(person.getId()))
                .contains(active);
    }

    @Test
    void findByPersonIdAndValidToIsNullReturnsEmptyOnceClosed() {
        Club club = savedClub("riverside-cc");
        Person person = savedPerson();
        ClubMembership membership = clubMembershipRepository.save(ClubMembership.builder()
                .personId(person.getId())
                .clubId(club.getId())
                .build());
        membership.setValidTo(LocalDate.now());
        clubMembershipRepository.saveAndFlush(membership);

        assertThat(clubMembershipRepository.findByPersonIdAndValidToIsNull(person.getId())).isEmpty();
    }

    @Test
    void findByPersonIdAndClubIdReturnsTheMembershipRegardlessOfOpenOrClosedState() {
        Club club = savedClub("riverside-cc");
        Person person = savedPerson();
        ClubMembership membership = clubMembershipRepository.save(ClubMembership.builder()
                .personId(person.getId())
                .clubId(club.getId())
                .validTo(LocalDate.now())
                .build());

        assertThat(clubMembershipRepository.findByPersonIdAndClubId(person.getId(), club.getId()))
                .contains(membership);
    }

    @Test
    void findByPersonIdAndClubIdStaysUnambiguousWhenThePersonHoldsASecondMembershipAtADifferentClub() {
        Club club = savedClub("riverside-cc");
        Club otherClub = savedClub("lakeside-cc");
        Person person = savedPerson();
        ClubMembership ownMembership = clubMembershipRepository.save(ClubMembership.builder()
                .personId(person.getId())
                .clubId(club.getId())
                .validTo(LocalDate.now())
                .build());
        clubMembershipRepository.save(
                ClubMembership.builder().personId(person.getId()).clubId(otherClub.getId()).build());

        assertThat(clubMembershipRepository.findByPersonIdAndClubId(person.getId(), club.getId()))
                .contains(ownMembership);
    }

    @Test
    void validFromDefaultsToTodayViaPrePersistWhenUnset() {
        Club club = savedClub("riverside-cc");
        Person person = savedPerson();
        ClubMembership membership =
                ClubMembership.builder().personId(person.getId()).clubId(club.getId()).build();
        assertThat(membership.getValidFrom()).isNull();

        ClubMembership saved = clubMembershipRepository.save(membership);

        assertThat(saved.getValidFrom()).isEqualTo(LocalDate.now());
    }

    @Test
    void uxClubMembershipActiveRejectsASecondOpenMembershipForTheSamePersonAtTheDbLevel() {
        Club clubA = savedClub("riverside-cc");
        Club clubB = savedClub("lakeside-cc");
        Person person = savedPerson();
        clubMembershipRepository.save(
                ClubMembership.builder().personId(person.getId()).clubId(clubA.getId()).build());

        ClubMembership secondOpenMembership =
                ClubMembership.builder().personId(person.getId()).clubId(clubB.getId()).build();

        assertThatThrownBy(() -> clubMembershipRepository.saveAndFlush(secondOpenMembership))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void aPersonCanHaveASecondMembershipRowOnceTheFirstIsClosed() {
        Club clubA = savedClub("riverside-cc");
        Club clubB = savedClub("lakeside-cc");
        Person person = savedPerson();
        ClubMembership first = clubMembershipRepository.save(
                ClubMembership.builder().personId(person.getId()).clubId(clubA.getId()).build());
        first.setValidTo(LocalDate.now());
        clubMembershipRepository.saveAndFlush(first);

        ClubMembership second = ClubMembership.builder()
                .personId(person.getId())
                .clubId(clubB.getId())
                .build();

        ClubMembership saved = clubMembershipRepository.saveAndFlush(second);

        assertThat(saved.getId()).isNotNull();
    }
}
