package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.dto.TeamDashboardDto;
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
 * N+1 guard for docs/specs/117-stats-dashboard.md ("Statement count fixed per request"): the team Dashboard issues the same
 * small set of SQL statements for a small club as for one with many more teams and results, whatever the number of points,
 * bowler rows and extras. Not {@code @Transactional}; same technique as {@link TeamStatsQueryCountIntegrationTest}.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@Import(AbstractIntegrationTest.class)
class TeamDashboardQueryCountIntegrationTest {

    @Autowired
    private TeamDashboardService service;

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
    void theDashboardIssuesTheSameNumberOfStatementsWhateverTheNumberOfTeamsResultsOrPoints() {
        small = new PlayerStatsSeed(context);
        large = new PlayerStatsSeed(context);
        small.seedDashboard(36);
        large.seedDashboard(150);
        large.addTeamBulk(40);
        var s = small.w.club().getId();
        var l = large.w.club().getId();

        TeamDashboardDto smallDashboard = service.get(admin, s, small.dbEagles.getId(), null, null, null);
        TeamDashboardDto largeDashboard = service.get(admin, l, large.dbEagles.getId(), null, null, null);
        assertThat(smallDashboard.resultsSummary().played()).isEqualTo(42);
        assertThat(largeDashboard.resultsSummary().played()).isGreaterThan(150);
        assertThat(largeDashboard.results()).hasSize(30);

        long baseline = statements(() -> service.get(admin, s, small.dbEagles.getId(), null, null, null));
        assertThat(baseline).as("the statements are counted at all").isPositive();
        assertThat(baseline).as("a small, fixed set").isLessThanOrEqualTo(15);
        assertThat(statements(() -> service.get(admin, l, large.dbEagles.getId(), null, null, null)))
                .as("a bigger club and many more results")
                .isEqualTo(baseline);
        assertThat(statements(() -> service.get(admin, l, large.dbEagles.getId(), large.s1.getId(), large.l1.getId(), "LEAGUE")))
                .as("every filter")
                .isEqualTo(statements(() -> service.get(admin, s, small.dbEagles.getId(), small.s1.getId(), small.l1.getId(), "LEAGUE")));
        // the derby opponent (one result) takes the same statements as a team with many
        assertThat(statements(() -> service.get(admin, l, large.dbRooks.getId(), null, null, null)))
                .isEqualTo(statements(() -> service.get(admin, s, small.dbRooks.getId(), null, null, null)))
                .isEqualTo(baseline);
    }
}
