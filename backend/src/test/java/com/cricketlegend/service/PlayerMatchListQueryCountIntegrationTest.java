package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.dto.PlayerMatchListDto;
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
 * N+1 guard for docs/specs/115-player-match-list.md ("four small queries per page, none per row"): one page of the
 * match list issues the same number of SQL statements for a small club as for one in which the player has 25 more
 * results, whatever the number of rows on the page. Not {@code @Transactional}; same technique as {@link
 * PlayerStatsQueryCountIntegrationTest}.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@Import(AbstractIntegrationTest.class)
class PlayerMatchListQueryCountIntegrationTest {

    @Autowired
    private PlayerMatchListService matchListService;

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
    void onePageIssuesTheSameNumberOfStatementsWhateverTheNumberOfResultsOrRowsOnThePage() {
        small = new PlayerStatsSeed(context);
        large = new PlayerStatsSeed(context);
        small.seedMatchList();
        large.seedMatchList();
        large.addMatchesFor(large.alice, 25);
        large.addBulk(25);
        var s = small.w.club().getId();
        var l = large.w.club().getId();

        // Alice: 5 matches in the small club, 30 in the large one (so a full page of 20 against five rows)
        PlayerMatchListDto smallPage = matchListService.list(
                admin, s, small.alice.getId(), null, null, null, null, null, null, 0, 20);
        PlayerMatchListDto largePage = matchListService.list(
                admin, l, large.alice.getId(), null, null, null, null, null, null, 0, 20);
        assertThat(smallPage.rows()).hasSize(5);
        assertThat(largePage.rows()).hasSize(20);
        assertThat(largePage.page().totalElements()).isEqualTo(30);

        assertThat(statements(() -> matchListService.list(
                admin, l, large.alice.getId(), null, null, null, null, null, null, 0, 20)))
                .as("a full page of a bigger club")
                .isEqualTo(statements(() -> matchListService.list(
                        admin, s, small.alice.getId(), null, null, null, null, null, null, 0, 20)));
        // a later page, a different direction and a derby player on two sides change nothing either
        long baseline = statements(() -> matchListService.list(
                admin, s, small.alice.getId(), null, null, null, null, null, null, 0, 20));
        assertThat(statements(() -> matchListService.list(
                admin, l, large.alice.getId(), null, null, null, null, null, "asc", 1, 7))).as("page 2, ascending")
                .isEqualTo(baseline);
        // filters add the fixed lookups of the scope resolver, the same for a small and a large club
        assertThat(statements(() -> matchListService.list(
                admin, l, large.alice.getId(), large.s1.getId(), large.l1.getId(), null, large.w.seniors().getId(),
                "LEAGUE", null, 0, 20))).as("every filter")
                .isEqualTo(statements(() -> matchListService.list(
                        admin, s, small.alice.getId(), small.s1.getId(), small.l1.getId(), null,
                        small.w.seniors().getId(), "LEAGUE", null, 0, 20)));
        assertThat(statements(() -> matchListService.list(
                admin, l, large.dan.getId(), null, null, null, null, null, null, 0, 20))).as("a derby row")
                .isEqualTo(baseline);
        assertThat(statements(() -> matchListService.list(
                admin, l, large.ivy.getId(), null, null, null, null, null, null, 0, 20))).as("a multi-innings row")
                .isEqualTo(baseline);
    }
}
