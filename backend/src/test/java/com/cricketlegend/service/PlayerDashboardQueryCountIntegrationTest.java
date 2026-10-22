package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.dto.PlayerDashboardDto;
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
 * N+1 guard for docs/specs/117-stats-dashboard.md ("Statement count fixed per request"): the player Dashboard issues the
 * same small set of SQL statements for a small club as for one in which the player has many more results and the club many
 * more players, whatever the number of points, bowling rows and credited dismissals (the bowler-row and dismissal counters
 * are part of that fixed set). Not {@code @Transactional}; same technique as {@link PlayerStatsQueryCountIntegrationTest}.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@Import(AbstractIntegrationTest.class)
class PlayerDashboardQueryCountIntegrationTest {

    @Autowired
    private PlayerDashboardService service;

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
    void theDashboardIssuesTheSameNumberOfStatementsWhateverTheNumberOfResultsPointsOrDismissals() {
        small = new PlayerStatsSeed(context);
        large = new PlayerStatsSeed(context);
        small.seedDashboard(36);
        large.seedDashboard(150);
        large.addBulk(25);
        var s = small.w.club().getId();
        var l = large.w.club().getId();

        PlayerDashboardDto smallDashboard = service.get(admin, s, small.dash.getId(), null, null, null, null, null);
        PlayerDashboardDto largeDashboard = service.get(admin, l, large.dash.getId(), null, null, null, null, null);
        assertThat(smallDashboard.battingTrend()).hasSize(35);
        assertThat(largeDashboard.battingTrend()).hasSizeGreaterThan(140);
        assertThat(largeDashboard.battingInnings()).hasSize(30);
        assertThat(largeDashboard.wicketTypes().total()).isGreaterThan(smallDashboard.wicketTypes().total());

        long baseline = statements(() -> service.get(admin, s, small.dash.getId(), null, null, null, null, null));
        assertThat(baseline).as("the statements are counted at all").isPositive();
        assertThat(baseline).as("a small, fixed set").isLessThanOrEqualTo(15);
        assertThat(statements(() -> service.get(admin, l, large.dash.getId(), null, null, null, null, null)))
                .as("a bigger club and many more matches")
                .isEqualTo(baseline);
        assertThat(statements(() -> service.get(admin, l, large.dash.getId(), null, null, large.dbEagles.getId(), null, null)))
                .as("a team filter")
                .isEqualTo(statements(() -> service.get(admin, s, small.dash.getId(), null, null, small.dbEagles.getId(), null, null)));
        assertThat(statements(() -> service.get(admin, l, large.dash.getId(), large.s1.getId(), large.l1.getId(), null,
                large.w.seniors().getId(), "LEAGUE")))
                .as("every filter")
                .isEqualTo(statements(() -> service.get(admin, s, small.dash.getId(), small.s1.getId(), small.l1.getId(), null,
                        small.w.seniors().getId(), "LEAGUE")));
        // a derby player on two sides and an over-credited bowler change nothing either
        long derby = statements(() -> service.get(admin, s, small.dee.getId(), null, null, null, null, null));
        assertThat(derby).isEqualTo(baseline);
        assertThat(statements(() -> service.get(admin, l, large.dee.getId(), null, null, null, null, null))).isEqualTo(derby);
        assertThat(statements(() -> service.get(admin, l, large.over.getId(), null, null, null, null, null))).isEqualTo(baseline);
    }
}
