package com.cricketlegend.repository;

import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueAffiliation;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration test for LeagueAffiliationRepository — per docs/standards/backend.md, proves the
 * {@code UNIQUE (league_id, team_id, season_id)} constraint genuinely rejects a duplicate triple
 * at the DB level, and that {@code existsByLeagueIdAndTeamIdAndSeasonId}/{@code findByLeagueId}
 * behave correctly. See docs/specs/029-league-management.md.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class LeagueAffiliationRepositoryTest {

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private LeagueRepository leagueRepository;

    @Autowired
    private SeasonRepository seasonRepository;

    @Autowired
    private LeagueAffiliationRepository leagueAffiliationRepository;

    private Club savedClub(String slug) {
        return clubRepository.save(Club.builder().name("Riverside CC").slug(slug).status(ClubStatus.ACTIVE).build());
    }

    private Team savedTeam(UUID clubId) {
        Section section = sectionRepository.save(Section.builder().clubId(clubId).name("Men").active(true).build());
        return teamRepository.save(
                Team.builder().clubId(clubId).sectionId(section.getId()).name("1st XI").active(true).build());
    }

    private League savedLeague(UUID clubId) {
        return leagueRepository.save(League.builder().clubId(clubId).name("Premier League")
                .source(LeagueSource.INTERNAL).maxPlayingXiSize(11).active(true).build());
    }

    private Season savedSeason(UUID clubId) {
        return seasonRepository.save(Season.builder().clubId(clubId).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true).build());
    }

    @Test
    void existsByLeagueIdAndTeamIdAndSeasonIdReflectsCurrentAffiliations() {
        Club club = savedClub("riverside-cc");
        League league = savedLeague(club.getId());
        Team team = savedTeam(club.getId());
        Season season = savedSeason(club.getId());

        assertThat(leagueAffiliationRepository.existsByLeagueIdAndTeamIdAndSeasonId(
                league.getId(), team.getId(), season.getId())).isFalse();

        leagueAffiliationRepository.save(LeagueAffiliation.builder()
                .leagueId(league.getId()).teamId(team.getId()).seasonId(season.getId()).build());

        assertThat(leagueAffiliationRepository.existsByLeagueIdAndTeamIdAndSeasonId(
                league.getId(), team.getId(), season.getId())).isTrue();
    }

    @Test
    void uniqueConstraintRejectsADuplicateLeagueTeamSeasonTripleAtTheDbLevel() {
        Club club = savedClub("riverside-cc");
        League league = savedLeague(club.getId());
        Team team = savedTeam(club.getId());
        Season season = savedSeason(club.getId());
        leagueAffiliationRepository.save(LeagueAffiliation.builder()
                .leagueId(league.getId()).teamId(team.getId()).seasonId(season.getId()).build());

        LeagueAffiliation duplicate = LeagueAffiliation.builder()
                .leagueId(league.getId()).teamId(team.getId()).seasonId(season.getId()).build();

        assertThatThrownBy(() -> leagueAffiliationRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void theSameTeamCanBeAffiliatedToTheSameLeagueAcrossDifferentSeasons() {
        Club club = savedClub("riverside-cc");
        League league = savedLeague(club.getId());
        Team team = savedTeam(club.getId());
        Season seasonOne = savedSeason(club.getId());
        Season seasonTwo = savedSeason(club.getId());
        leagueAffiliationRepository.save(LeagueAffiliation.builder()
                .leagueId(league.getId()).teamId(team.getId()).seasonId(seasonOne.getId()).build());

        LeagueAffiliation secondSeasonAffiliation = leagueAffiliationRepository.saveAndFlush(
                LeagueAffiliation.builder().leagueId(league.getId()).teamId(team.getId())
                        .seasonId(seasonTwo.getId()).build());

        assertThat(leagueAffiliationRepository.findByLeagueId(league.getId()))
                .extracting(LeagueAffiliation::getId)
                .contains(secondSeasonAffiliation.getId());
    }

    @Test
    void findTeamSummariesBySeasonIdReturnsOnlyTheSeasonNameSortedWithAProfileAndRepeatsATeamPerLeague() {
        Club club = savedClub("riverside-cc");
        League leagueOne = savedLeague(club.getId());
        League leagueTwo = savedLeague(club.getId());
        Section section = sectionRepository.save(Section.builder().clubId(club.getId()).name("Men").active(true).build());
        Team zulu = teamRepository.save(Team.builder().clubId(club.getId()).sectionId(section.getId())
                .name("zulu XI").abbreviation("ZUL").logoUrl("/zulu.png").active(true).build());
        Team alpha = teamRepository.save(Team.builder().clubId(club.getId()).sectionId(section.getId())
                .name("Alpha XI").active(true).build());
        Season season = savedSeason(club.getId());
        Season otherSeason = savedSeason(club.getId());
        leagueAffiliationRepository.save(LeagueAffiliation.builder()
                .leagueId(leagueOne.getId()).teamId(zulu.getId()).seasonId(season.getId()).build());
        leagueAffiliationRepository.save(LeagueAffiliation.builder()
                .leagueId(leagueOne.getId()).teamId(alpha.getId()).seasonId(season.getId()).build());
        leagueAffiliationRepository.save(LeagueAffiliation.builder()
                .leagueId(leagueTwo.getId()).teamId(zulu.getId()).seasonId(season.getId()).build());
        leagueAffiliationRepository.save(LeagueAffiliation.builder()
                .leagueId(leagueOne.getId()).teamId(alpha.getId()).seasonId(otherSeason.getId()).build());

        List<LeagueAffiliationRepository.LeagueTeamSummary> rows =
                leagueAffiliationRepository.findTeamSummariesBySeasonId(season.getId());

        assertThat(rows).extracting(LeagueAffiliationRepository.LeagueTeamSummary::getName)
                .containsExactly("Alpha XI", "zulu XI", "zulu XI");
        assertThat(rows).extracting(LeagueAffiliationRepository.LeagueTeamSummary::getLeagueId)
                .containsExactlyInAnyOrder(leagueOne.getId(), leagueOne.getId(), leagueTwo.getId());
        assertThat(rows.get(0).getAbbreviation()).isNull();
        assertThat(rows.get(0).getLogoUrl()).isNull();
        assertThat(rows.get(1).getAbbreviation()).isEqualTo("ZUL");
        assertThat(rows.get(1).getLogoUrl()).isEqualTo("/zulu.png");
        assertThat(rows.stream().filter(r -> r.getName().equals("zulu XI")).map(
                        LeagueAffiliationRepository.LeagueTeamSummary::getLeagueId))
                .containsExactlyInAnyOrder(leagueOne.getId(), leagueTwo.getId());
    }
}
