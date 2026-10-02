package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubContact;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Contact;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamContact;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration tests for TeamContactRepository — per docs/standards/backend.md, every custom
 * repository query ships a Testcontainers-backed integration test. Also proves
 * 019-add-team-profile.sql applies cleanly on top of 018 (implicit via context boot — this test
 * class only runs at all if the whole migration chain applied without error), and that the
 * {@code UNIQUE (team_id, club_contact_id)} constraint genuinely rejects a duplicate pair at the
 * DB level, bypassing the service layer entirely.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class TeamContactRepositoryTest {

    @Autowired
    private TeamContactRepository teamContactRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private ClubContactRepository clubContactRepository;

    private Club savedClub(String slug) {
        return clubRepository.save(Club.builder().name("Riverside CC").slug(slug).status(ClubStatus.ACTIVE).build());
    }

    private Section savedSection(UUID clubId) {
        return sectionRepository.save(
                Section.builder().clubId(clubId).name("Men").active(true).build());
    }

    private Team savedTeam(UUID clubId, UUID sectionId) {
        return teamRepository.save(
                Team.builder().clubId(clubId).sectionId(sectionId).name("1st XI").active(true).build());
    }

    private ClubContact savedClubContact(UUID clubId) {
        Contact contact = Contact.builder()
                .firstName("Casey")
                .lastName("Coach")
                .email("casey.coach@example.com")
                .phone("0123456789")
                .build();
        return clubContactRepository.save(ClubContact.builder()
                .clubId(clubId)
                .contact(contact)
                .role("Coach")
                .isPrimary(false)
                .active(true)
                .build());
    }

    @Test
    void findByTeamIdReturnsOnlyLinksForThatTeam() {
        Club club = savedClub("riverside-cc");
        Section section = savedSection(club.getId());
        Team teamA = savedTeam(club.getId(), section.getId());
        Team teamB = savedTeam(club.getId(), section.getId());
        ClubContact contact = savedClubContact(club.getId());
        TeamContact link = teamContactRepository.save(TeamContact.builder()
                .teamId(teamA.getId())
                .clubContactId(contact.getId())
                .role("Coach")
                .build());
        teamContactRepository.save(TeamContact.builder()
                .teamId(teamB.getId())
                .clubContactId(contact.getId())
                .role("Manager")
                .build());

        assertThat(teamContactRepository.findByTeamId(teamA.getId()))
                .extracting(TeamContact::getId)
                .containsExactly(link.getId());
    }

    @Test
    void existsByTeamIdAndClubContactIdReflectsCurrentLinks() {
        Club club = savedClub("riverside-cc");
        Section section = savedSection(club.getId());
        Team team = savedTeam(club.getId(), section.getId());
        ClubContact contact = savedClubContact(club.getId());

        assertThat(teamContactRepository.existsByTeamIdAndClubContactId(team.getId(), contact.getId()))
                .isFalse();

        teamContactRepository.save(TeamContact.builder()
                .teamId(team.getId())
                .clubContactId(contact.getId())
                .role("Coach")
                .build());

        assertThat(teamContactRepository.existsByTeamIdAndClubContactId(team.getId(), contact.getId()))
                .isTrue();
    }

    @Test
    void deleteByTeamIdAndClubContactIdRemovesTheJoinRow() {
        Club club = savedClub("riverside-cc");
        Section section = savedSection(club.getId());
        Team team = savedTeam(club.getId(), section.getId());
        ClubContact contact = savedClubContact(club.getId());
        teamContactRepository.save(TeamContact.builder()
                .teamId(team.getId())
                .clubContactId(contact.getId())
                .role("Coach")
                .build());

        teamContactRepository.deleteByTeamIdAndClubContactId(team.getId(), contact.getId());

        assertThat(teamContactRepository.findByTeamId(team.getId())).isEmpty();
    }

    @Test
    void uniqueConstraintRejectsADuplicateTeamAndClubContactPairAtTheDbLevel() {
        Club club = savedClub("riverside-cc");
        Section section = savedSection(club.getId());
        Team team = savedTeam(club.getId(), section.getId());
        ClubContact contact = savedClubContact(club.getId());
        teamContactRepository.save(TeamContact.builder()
                .teamId(team.getId())
                .clubContactId(contact.getId())
                .role("Coach")
                .build());

        TeamContact duplicate = TeamContact.builder()
                .teamId(team.getId())
                .clubContactId(contact.getId())
                .role("Manager")
                .build();

        assertThatThrownBy(() -> teamContactRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
