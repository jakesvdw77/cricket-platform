package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.support.PlayerStatsSeed;
import jakarta.persistence.EntityManagerFactory;
import java.util.function.Supplier;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * N+1 guard for docs/specs/116-team-stats.md ("Statement count"): the team table, one team page and the filter options
 * issue the same number of SQL statements for a small club as for one with many more teams and results, unfiltered and
 * with a season and a league filter. Not {@code @Transactional}; same technique as {@code PlayerStatsQueryCountIntegrationTest}.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@Import(AbstractIntegrationTest.class)
class TeamStatsQueryCountIntegrationTest {

    @Autowired
    private TeamStatsService service;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Autowired
    private ApplicationContext context;

    private final Authentication admin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");
    private PlayerStatsSeed small;
    private PlayerStatsSeed large;

    @AfterEach
    void cleanUp() {
        if (small != null) {
            small.cleanUp();
        }
        if (large != null) {
            large.cleanUp();
        }
    }

    private long statements(Supplier<Object> call) {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        assertThat(statistics.isStatisticsEnabled()).isTrue();
        statistics.clear();
        call.get();
        return statistics.getPrepareStatementCount();
    }

    @Test
    void theTableTheTeamPageAndTheOptionsIssueTheSameNumberOfStatementsWhateverTheClubSize() {
        small = new PlayerStatsSeed(context);
        small.seedTeamStats();
        large = new PlayerStatsSeed(context);
        large.seedTeamStats();
        large.addTeamBulk(40);
        var s = small.w.club().getId();
        var l = large.w.club().getId();

        long smallTable = statements(() -> service.table(admin, s, null, null, null, null, null, null, null, 0, 10));
        assertThat(smallTable).as("the statements are counted at all").isPositive();
        assertThat(statements(() -> service.table(admin, l, null, null, null, null, null, null, null, 0, 10)))
                .as("table")
                .isEqualTo(smallTable);
        assertThat(statements(() -> service.table(admin, l, "netRunRate", "asc", null, null, null, null, "1", 0, 10)))
                .as("table sorted by a rate with a minimum")
                .isEqualTo(statements(() -> service.table(admin, s, "netRunRate", "asc", null, null, null, null, "1", 0, 10)));
        assertThat(statements(() -> service.table(
                admin, l, null, null, large.s1.getId(), large.l1.getId(), large.seniorsA.getId(), "LEAGUE", null, 0, 10)))
                .as("filtered table")
                .isEqualTo(statements(() -> service.table(
                        admin, s, null, null, small.s1.getId(), small.l1.getId(), small.seniorsA.getId(), "LEAGUE", null, 0, 10)));
        assertThat(statements(() -> service.team(admin, l, large.tsHawks.getId(), null, null, null)))
                .as("team page")
                .isEqualTo(statements(() -> service.team(admin, s, small.tsHawks.getId(), null, null, null)));
        assertThat(statements(() -> service.team(admin, l, large.tsHawks.getId(), large.s1.getId(), large.l1.getId(), "LEAGUE")))
                .as("filtered team page")
                .isEqualTo(statements(() -> service.team(
                        admin, s, small.tsHawks.getId(), small.s1.getId(), small.l1.getId(), "LEAGUE")));
        assertThat(statements(() -> service.filterOptions(admin, l, null)))
                .as("filter options")
                .isEqualTo(statements(() -> service.filterOptions(admin, s, null)));
    }
}
