package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration test for TeamSquadMemberRepository — per docs/standards/backend.md, proves the
 * {@code UNIQUE (team_id, season_id, player_profile_id)} constraint at the DB level, and that
 * every query is genuinely scoped by {@code (teamId, seasonId)} together — the season-scoping
 * amendment's own point, per docs/specs/029-league-management.md's Rollout Notes: a player can be
 * (re)added independently for each season, and removing them from one season's squad has no
 * effect on another's.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class TeamSquadMemberRepositoryTest {

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private SeasonRepository seasonRepository;

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private PlayerProfileRepository playerProfileRepository;

    @Autowired
    private TeamSquadMemberRepository teamSquadMemberRepository;

    private Club savedClub(String slug) {
        return clubRepository.save(Club.builder().name("Riverside CC").slug(slug).status(ClubStatus.ACTIVE).build());
    }

    private Team savedTeam(UUID clubId) {
        Section section = sectionRepository.save(Section.builder().clubId(clubId).name("Men").active(true).build());
        return teamRepository.save(
                Team.builder().clubId(clubId).sectionId(section.getId()).name("1st XI").active(true).build());
    }

    private Season savedSeason(UUID clubId) {
        return seasonRepository.save(Season.builder().clubId(clubId).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true).build());
    }

    private PlayerProfile savedPlayer(UUID clubId) {
        Person person = personRepository.save(Person.builder().firstName("Joe").lastName("Bloggs").build());
        return playerProfileRepository.save(
                PlayerProfile.builder().personId(person.getId()).clubId(clubId).active(true).build());
    }

    @Test
    void aPlayerIsAddableToTheSameTeamsSquadForTwoDifferentSeasonsIndependently() {
        Club club = savedClub("riverside-cc");
        Team team = savedTeam(club.getId());
        Season seasonA = savedSeason(club.getId());
        Season seasonB = savedSeason(club.getId());
        PlayerProfile player = savedPlayer(club.getId());

        teamSquadMemberRepository.save(TeamSquadMember.builder()
                .teamId(team.getId()).seasonId(seasonA.getId()).playerProfileId(player.getId()).build());
        teamSquadMemberRepository.saveAndFlush(TeamSquadMember.builder()
                .teamId(team.getId()).seasonId(seasonB.getId()).playerProfileId(player.getId()).build());

        assertThat(teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndPlayerProfileId(
                team.getId(), seasonA.getId(), player.getId())).isTrue();
        assertThat(teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndPlayerProfileId(
                team.getId(), seasonB.getId(), player.getId())).isTrue();
    }

    @Test
    void removingAPlayerFromOneSeasonsSquadHasNoEffectOnAnotherSeasonsRow() {
        Club club = savedClub("riverside-cc");
        Team team = savedTeam(club.getId());
        Season seasonA = savedSeason(club.getId());
        Season seasonB = savedSeason(club.getId());
        PlayerProfile player = savedPlayer(club.getId());
        teamSquadMemberRepository.save(TeamSquadMember.builder()
                .teamId(team.getId()).seasonId(seasonA.getId()).playerProfileId(player.getId()).build());
        teamSquadMemberRepository.save(TeamSquadMember.builder()
                .teamId(team.getId()).seasonId(seasonB.getId()).playerProfileId(player.getId()).build());

        teamSquadMemberRepository.deleteByTeamIdAndSeasonIdAndPlayerProfileId(
                team.getId(), seasonA.getId(), player.getId());

        assertThat(teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndPlayerProfileId(
                team.getId(), seasonA.getId(), player.getId())).isFalse();
        assertThat(teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndPlayerProfileId(
                team.getId(), seasonB.getId(), player.getId())).isTrue();
    }

    @Test
    void uniqueConstraintRejectsADuplicateTeamSeasonPlayerTripleAtTheDbLevel() {
        Club club = savedClub("riverside-cc");
        Team team = savedTeam(club.getId());
        Season season = savedSeason(club.getId());
        PlayerProfile player = savedPlayer(club.getId());
        teamSquadMemberRepository.save(TeamSquadMember.builder()
                .teamId(team.getId()).seasonId(season.getId()).playerProfileId(player.getId()).build());

        TeamSquadMember duplicate = TeamSquadMember.builder()
                .teamId(team.getId()).seasonId(season.getId()).playerProfileId(player.getId()).build();

        assertThatThrownBy(() -> teamSquadMemberRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void findByTeamIdAndSeasonIdReturnsOnlyThatSeasonsSquad() {
        Club club = savedClub("riverside-cc");
        Team team = savedTeam(club.getId());
        Season seasonA = savedSeason(club.getId());
        Season seasonB = savedSeason(club.getId());
        PlayerProfile playerInA = savedPlayer(club.getId());
        PlayerProfile playerInB = savedPlayer(club.getId());
        teamSquadMemberRepository.save(TeamSquadMember.builder()
                .teamId(team.getId()).seasonId(seasonA.getId()).playerProfileId(playerInA.getId()).build());
        teamSquadMemberRepository.save(TeamSquadMember.builder()
                .teamId(team.getId()).seasonId(seasonB.getId()).playerProfileId(playerInB.getId()).build());

        assertThat(teamSquadMemberRepository.findByTeamIdAndSeasonId(team.getId(), seasonA.getId()))
                .extracting(TeamSquadMember::getPlayerProfileId)
                .containsExactly(playerInA.getId());
    }
}
