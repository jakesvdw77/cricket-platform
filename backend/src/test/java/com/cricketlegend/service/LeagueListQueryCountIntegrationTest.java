package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueAffiliation;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.LeagueTeam;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.LeagueDto;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.LeagueAffiliationRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.LeagueTeamRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import jakarta.persistence.EntityManagerFactory;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * N+1 guard for docs/specs/071-league-card-redesign.md: {@code LeagueService.list} issues the same
 * number of SQL statements for a club with 1 league as for a club with 12. Deliberately NOT
 * {@code @Transactional} (docs/standards/backend.md): the service method's own transaction is what
 * is measured, and rows are removed in {@code @AfterEach} instead of rolled back. Hibernate
 * statistics are not on by default, so they are enabled for this test class only.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@Import(AbstractIntegrationTest.class)
class LeagueListQueryCountIntegrationTest {

    @Autowired
    private LeagueService leagueService;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private SeasonRepository seasonRepository;

    @Autowired
    private LeagueRepository leagueRepository;

    @Autowired
    private LeagueAffiliationRepository leagueAffiliationRepository;

    @Autowired
    private LeagueTeamRepository leagueTeamRepository;

    @Autowired
    private MatchRepository matchRepository;

    private final List<Club> clubs = new ArrayList<>();
    private final List<Section> sections = new ArrayList<>();
    private final List<Team> teams = new ArrayList<>();
    private final List<Season> seasons = new ArrayList<>();
    private final List<League> leagues = new ArrayList<>();
    private final List<LeagueAffiliation> affiliations = new ArrayList<>();
    private final List<LeagueTeam> leagueTeams = new ArrayList<>();
    private final List<Match> matches = new ArrayList<>();

    @AfterEach
    void cleanUp() {
        matchRepository.deleteAll(matches);
        leagueAffiliationRepository.deleteAll(affiliations);
        leagueTeamRepository.deleteAll(leagueTeams);
        leagueRepository.deleteAll(leagues);
        teamRepository.deleteAll(teams);
        sectionRepository.deleteAll(sections);
        seasonRepository.deleteAll(seasons);
        clubRepository.deleteAll(clubs);
    }

    private Club seedClubWithLeagues(String slug, int leagueCount) {
        Club club = clubRepository.save(
                Club.builder().name(slug).slug(slug).status(ClubStatus.ACTIVE).build());
        clubs.add(club);
        LocalDate today = LocalDate.now();
        Season season = seasonRepository.save(Season.builder().clubId(club.getId()).label("Current")
                .startDate(today.minusMonths(1)).endDate(today.plusMonths(1)).active(true).build());
        seasons.add(season);
        Section section = sectionRepository.save(Section.builder().clubId(club.getId()).name("Men").active(true).build());
        sections.add(section);
        Team team = teamRepository.save(
                Team.builder().clubId(club.getId()).sectionId(section.getId()).name("1st XI").active(true).build());
        teams.add(team);
        for (int i = 0; i < leagueCount; i++) {
            League league = leagueRepository.save(League.builder().clubId(club.getId()).name("League " + i)
                    .source(LeagueSource.INTERNAL).maxPlayingXiSize(11).active(true).build());
            leagues.add(league);
            affiliations.add(leagueAffiliationRepository.save(LeagueAffiliation.builder()
                    .leagueId(league.getId()).teamId(team.getId()).seasonId(season.getId()).build()));
            leagueTeams.add(leagueTeamRepository.save(LeagueTeam.builder().leagueId(league.getId())
                    .seasonId(season.getId()).name("Opponent " + i).active(true).build()));
            for (long dayOffset : new long[] {-3, 3}) {
                matches.add(matchRepository.save(Match.builder().clubId(club.getId()).homeTeamName("Home")
                        .awayTeamName("Away").leagueId(league.getId()).seasonId(season.getId())
                        .matchDate(Instant.now().plus(dayOffset, ChronoUnit.DAYS)).active(true).build()));
            }
        }
        return club;
    }

    private long statementsFor(UUID clubId) {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        assertThat(statistics.isStatisticsEnabled()).isTrue();
        statistics.clear();
        List<LeagueDto> result = leagueService.list(clubId);
        assertThat(result).isNotEmpty();
        return statistics.getPrepareStatementCount();
    }

    @Test
    void listIssuesTheSameNumberOfStatementsForOneLeagueAsForTwelve() {
        Club small = seedClubWithLeagues("n-plus-one-small", 1);
        Club large = seedClubWithLeagues("n-plus-one-large", 12);

        long smallCount = statementsFor(small.getId());
        long largeCount = statementsFor(large.getId());

        assertThat(largeCount).isEqualTo(smallCount);
        assertThat(leagueService.list(large.getId())).hasSize(12)
                .allSatisfy(dto -> {
                    assertThat(dto.matchCount()).isEqualTo(2);
                    assertThat(dto.teams()).hasSize(2);
                });
    }
}
