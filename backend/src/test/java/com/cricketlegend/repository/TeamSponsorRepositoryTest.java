package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Sponsor;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSponsor;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration tests for TeamSponsorRepository — per docs/standards/backend.md, every custom
 * repository query ships a Testcontainers-backed integration test. Also proves
 * 019-add-team-profile.sql applies cleanly on top of 018 (implicit via context boot — this test
 * class only runs at all if the whole migration chain applied without error), and that the
 * {@code UNIQUE (team_id, sponsor_id)} constraint genuinely rejects a duplicate pair at the DB
 * level, bypassing the service layer entirely.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class TeamSponsorRepositoryTest {

    @Autowired
    private TeamSponsorRepository teamSponsorRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SponsorRepository sponsorRepository;

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

    private Sponsor savedSponsor(UUID clubId) {
        return sponsorRepository.save(
                Sponsor.builder().clubId(clubId).name("Acme Co").active(true).build());
    }

    @Test
    void findByTeamIdReturnsOnlyLinksForThatTeam() {
        Club club = savedClub("riverside-cc");
        Section section = savedSection(club.getId());
        Team teamA = savedTeam(club.getId(), section.getId());
        Team teamB = savedTeam(club.getId(), section.getId());
        Sponsor sponsor = savedSponsor(club.getId());
        TeamSponsor link = teamSponsorRepository.save(
                TeamSponsor.builder().teamId(teamA.getId()).sponsorId(sponsor.getId()).build());
        teamSponsorRepository.save(
                TeamSponsor.builder().teamId(teamB.getId()).sponsorId(sponsor.getId()).build());

        assertThat(teamSponsorRepository.findByTeamId(teamA.getId()))
                .extracting(TeamSponsor::getId)
                .containsExactly(link.getId());
    }

    @Test
    void existsByTeamIdAndSponsorIdReflectsCurrentLinks() {
        Club club = savedClub("riverside-cc");
        Section section = savedSection(club.getId());
        Team team = savedTeam(club.getId(), section.getId());
        Sponsor sponsor = savedSponsor(club.getId());

        assertThat(teamSponsorRepository.existsByTeamIdAndSponsorId(team.getId(), sponsor.getId()))
                .isFalse();

        teamSponsorRepository.save(
                TeamSponsor.builder().teamId(team.getId()).sponsorId(sponsor.getId()).build());

        assertThat(teamSponsorRepository.existsByTeamIdAndSponsorId(team.getId(), sponsor.getId()))
                .isTrue();
    }

    @Test
    void deleteByTeamIdAndSponsorIdRemovesTheJoinRow() {
        Club club = savedClub("riverside-cc");
        Section section = savedSection(club.getId());
        Team team = savedTeam(club.getId(), section.getId());
        Sponsor sponsor = savedSponsor(club.getId());
        teamSponsorRepository.save(
                TeamSponsor.builder().teamId(team.getId()).sponsorId(sponsor.getId()).build());

        teamSponsorRepository.deleteByTeamIdAndSponsorId(team.getId(), sponsor.getId());

        assertThat(teamSponsorRepository.findByTeamId(team.getId())).isEmpty();
    }

    @Test
    void uniqueConstraintRejectsADuplicateTeamAndSponsorPairAtTheDbLevel() {
        Club club = savedClub("riverside-cc");
        Section section = savedSection(club.getId());
        Team team = savedTeam(club.getId(), section.getId());
        Sponsor sponsor = savedSponsor(club.getId());
        teamSponsorRepository.save(
                TeamSponsor.builder().teamId(team.getId()).sponsorId(sponsor.getId()).build());

        TeamSponsor duplicate =
                TeamSponsor.builder().teamId(team.getId()).sponsorId(sponsor.getId()).build();

        assertThatThrownBy(() -> teamSponsorRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
