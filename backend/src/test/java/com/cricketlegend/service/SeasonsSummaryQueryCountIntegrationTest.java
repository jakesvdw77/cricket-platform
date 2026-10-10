package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.SeasonsSummaryDto;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * N+1 guard for docs/specs/094-club-structure-and-seasons.md: {@code SeasonService.summary} issues the same number of SQL
 * statements for a club with a few seasons as for one with many (never a lookup per season). Not {@code @Transactional};
 * rows are removed in {@code @AfterEach}. Same technique as {@code SectionsSummaryQueryCountIntegrationTest}.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@Import(AbstractIntegrationTest.class)
class SeasonsSummaryQueryCountIntegrationTest {

    @Autowired
    private SeasonService seasonService;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Autowired
    private ApplicationContext context;

    private ManagerOverviewFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new ManagerOverviewFixtures(context);
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    private World seedClub(int seasons) {
        World w = fixtures.world();
        League league = fixtures.league(w, 11);
        for (int i = 0; i < seasons; i++) {
            Season season = fixtures.season(w.club(), "Season " + i);
            Team team = fixtures.team(w.club(), w.seniors(), "Team " + i);
            fixtures.affiliate(league, team, season);
            fixtures.matchIn(w, season, team, true);
        }
        return w;
    }

    private long statementsFor(World w, int expectedSeasons) {
        Authentication admin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        assertThat(statistics.isStatisticsEnabled()).isTrue();
        statistics.clear();
        SeasonsSummaryDto result = seasonService.summary(admin, w.club().getId());
        assertThat(result.seasons()).hasSize(expectedSeasons);
        return statistics.getPrepareStatementCount();
    }

    @Test
    void summaryIssuesTheSameNumberOfStatementsForFewSeasonsAsForMany() {
        World small = seedClub(2);
        World large = seedClub(25);

        // the world's own season plus the seeded ones
        assertThat(statementsFor(large, 26)).isEqualTo(statementsFor(small, 3));
    }
}
