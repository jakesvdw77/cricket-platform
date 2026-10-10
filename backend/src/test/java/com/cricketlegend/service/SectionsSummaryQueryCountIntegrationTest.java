package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.SectionsSummaryDto;
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
 * N+1 guard for docs/specs/094-club-structure-and-seasons.md: {@code SectionService.summary} issues the same number of SQL
 * statements for a club with a few sections, teams and players as for one with many (never a lookup per section). Not
 * {@code @Transactional}; rows are removed in {@code @AfterEach}. Same technique as
 * {@code PlayersSummaryQueryCountIntegrationTest}.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@Import(AbstractIntegrationTest.class)
class SectionsSummaryQueryCountIntegrationTest {

    @Autowired
    private SectionService sectionService;

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

    private World seedClub(int size) {
        World w = fixtures.world();
        League league = fixtures.league(w, 11);
        Section parent = w.juniors();
        for (int i = 0; i < size; i++) {
            Section section = fixtures.childSection(w.club(), parent, "Section " + i);
            Team team = fixtures.team(w.club(), section, "Team " + i);
            fixtures.affiliate(league, team, w.season());
            PlayerProfile player = fixtures.player(w, "Player" + i, true);
            fixtures.tag(section, player);
            if (i % 2 == 0) {
                parent = section;
            }
        }
        return w;
    }

    private long statementsFor(World w) {
        Authentication admin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        assertThat(statistics.isStatisticsEnabled()).isTrue();
        statistics.clear();
        SectionsSummaryDto result = sectionService.summary(admin, w.club().getId(), w.season().getId());
        assertThat(result.sections()).hasSizeGreaterThan(2);
        return statistics.getPrepareStatementCount();
    }

    @Test
    void summaryIssuesTheSameNumberOfStatementsForASmallClubAsForALargeOne() {
        World small = seedClub(3);
        World large = seedClub(30);

        assertThat(statementsFor(large)).isEqualTo(statementsFor(small));
    }
}
