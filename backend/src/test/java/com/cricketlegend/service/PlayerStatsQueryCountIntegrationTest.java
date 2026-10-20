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
 * N+1 guard for docs/specs/103-player-stats.md ("one aggregate query family"): a leaderboard, the awards view and a
 * player's stats issue the same number of SQL statements for a small club as for one with many more players and results.
 * Not {@code @Transactional}; same technique as {@code MatchesSummaryQueryCountIntegrationTest}.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@Import(AbstractIntegrationTest.class)
class PlayerStatsQueryCountIntegrationTest {

    @Autowired
    private PlayerStatsService playerStatsService;

    @Autowired
    private LeaderboardService leaderboardService;

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
    void boardsAwardsAndThePlayerPageIssueTheSameNumberOfStatementsWhateverTheClubSize() {
        small = new PlayerStatsSeed(context);
        large = new PlayerStatsSeed(context);
        large.addBulk(25);
        var s = small.w.club().getId();
        var l = large.w.club().getId();

        for (String group : new String[] {"batting", "bowling", "fielding"}) {
            assertThat(statements(() -> leaderboardService.table(
                    admin, l, group, null, null, null, null, null, null, null, 0, 10)))
                    .as(group + " table")
                    .isEqualTo(statements(() -> leaderboardService.table(
                            admin, s, group, null, null, null, null, null, null, null, 0, 10)));
        }
        assertThat(statements(() -> leaderboardService.awards(admin, l, null, null, null, null, null, null)))
                .as("awards view")
                .isEqualTo(statements(() -> leaderboardService.awards(admin, s, null, null, null, null, null, null)));
        assertThat(statements(() -> playerStatsService.get(
                admin, l, large.alice.getId(), null, null, null, null, null)))
                .as("player page")
                .isEqualTo(statements(() -> playerStatsService.get(
                        admin, s, small.alice.getId(), null, null, null, null, null)));
    }
}
