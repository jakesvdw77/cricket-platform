package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration tests for TeamRepository — per docs/standards/backend.md, every custom repository
 * query ships a Testcontainers-backed integration test. Also proves 018-add-team.sql applies
 * cleanly on top of 017 (implicit via context boot — this test class only runs at all if the
 * whole migration chain applied without error), and that {@code club_id}/{@code section_id}'s FKs
 * genuinely reject a reference to a nonexistent {@link Club}/{@link Section} at the DB level.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class TeamRepositoryTest {

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private ClubRepository clubRepository;

    private Club savedClub(String slug) {
        return clubRepository.save(Club.builder().name("Riverside CC").slug(slug).status(ClubStatus.ACTIVE).build());
    }

    private Section savedSection(UUID clubId, String name) {
        return sectionRepository.save(
                Section.builder().clubId(clubId).name(name).active(true).build());
    }

    private Team team(UUID clubId, UUID sectionId, String name) {
        return teamRepository.save(
                Team.builder().clubId(clubId).sectionId(sectionId).name(name).active(true).build());
    }

    @Test
    void findByClubIdAndSectionIdReturnsOnlyTeamsForThatSection() {
        Club club = savedClub("riverside-cc");
        Section sectionA = savedSection(club.getId(), "Men");
        Section sectionB = savedSection(club.getId(), "Women");
        Team teamA = team(club.getId(), sectionA.getId(), "1st XI");
        team(club.getId(), sectionB.getId(), "1st XI");

        assertThat(teamRepository.findByClubIdAndSectionId(club.getId(), sectionA.getId()))
                .extracting(Team::getId)
                .containsExactly(teamA.getId());
    }

    @Test
    void findByClubIdReturnsEveryTeamAcrossMultipleSections() {
        Club club = savedClub("riverside-cc");
        Section sectionA = savedSection(club.getId(), "Men");
        Section sectionB = savedSection(club.getId(), "Women");
        Team teamA = team(club.getId(), sectionA.getId(), "1st XI");
        Team teamB = team(club.getId(), sectionB.getId(), "1st XI");

        assertThat(teamRepository.findByClubId(club.getId()))
                .extracting(Team::getId)
                .containsExactlyInAnyOrder(teamA.getId(), teamB.getId());
    }

    @Test
    void findByClubIdReturnsOnlyTeamsForThatClub() {
        Club clubX = savedClub("riverside-cc");
        Club clubY = savedClub("lakeside-cc");
        Section sectionX = savedSection(clubX.getId(), "Men");
        Section sectionY = savedSection(clubY.getId(), "Men");
        Team teamForX = team(clubX.getId(), sectionX.getId(), "1st XI");
        team(clubY.getId(), sectionY.getId(), "1st XI");

        assertThat(teamRepository.findByClubId(clubX.getId()))
                .extracting(Team::getId)
                .containsExactly(teamForX.getId());
    }

    @Test
    void clubIdFkRejectsAReferenceToANonexistentClub() {
        Club club = savedClub("riverside-cc");
        Section section = savedSection(club.getId(), "Men");
        Team orphan = Team.builder()
                .clubId(UUID.randomUUID())
                .sectionId(section.getId())
                .name("1st XI")
                .active(true)
                .build();

        assertThatThrownBy(() -> teamRepository.saveAndFlush(orphan))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void sectionIdFkRejectsAReferenceToANonexistentSection() {
        Club club = savedClub("riverside-cc");
        Team orphan = Team.builder()
                .clubId(club.getId())
                .sectionId(UUID.randomUUID())
                .name("1st XI")
                .active(true)
                .build();

        assertThatThrownBy(() -> teamRepository.saveAndFlush(orphan))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void deletingASectionStillReferencedByATeamsSectionIdFailsAtTheDbLevel() {
        Club club = savedClub("riverside-cc");
        Section section = savedSection(club.getId(), "Men");
        team(club.getId(), section.getId(), "1st XI");

        assertThatThrownBy(() -> {
                    sectionRepository.delete(section);
                    sectionRepository.flush();
                })
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
