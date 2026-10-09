package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Match;
import com.cricketlegend.dto.MatchesSummaryDto;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import jakarta.persistence.EntityManagerFactory;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
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
 * N+1 guard for docs/specs/087-matches-polls-alignment.md: {@code MatchService.summary} issues the same number of SQL
 * statements for a club with a few matches as for one with many (the counters are count queries, never a load of the
 * matches). Not {@code @Transactional}; rows are removed in {@code @AfterEach}. Same technique as {@code
 * AvailabilitySummaryQueryCountIntegrationTest}.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@Import(AbstractIntegrationTest.class)
class MatchesSummaryQueryCountIntegrationTest {

    @Autowired
    private MatchService matchService;

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
        Instant now = Instant.now();
        for (int i = 0; i < size; i++) {
            boolean juniors = i % 2 == 1;
            var team = juniors ? w.juniorsTeam() : w.seniors1();
            Match match = fixtures.match(w, team, i % 3 == 0 ? w.seniors2() : null, now.plus(Duration.ofDays(1 + i)));
            fixtures.side(match, team, i % 2 == 0);
            if (i % 3 == 1) {
                fixtures.squadPoll(match, team, null);
            }
            fixtures.match(w, team, null, now.minus(Duration.ofDays(2 + i))); // history
        }
        return w;
    }

    private long statementsFor(Authentication caller, UUID clubId, UUID sectionId, UUID teamId, boolean includePast) {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        assertThat(statistics.isStatisticsEnabled()).isTrue();
        statistics.clear();
        MatchesSummaryDto result = matchService.summary(caller, clubId, sectionId, null, null, teamId, null, includePast);
        assertThat(result.matchesShown()).isPositive();
        return statistics.getPrepareStatementCount();
    }

    @Test
    void summaryIssuesTheSameNumberOfStatementsForASmallClubAsForALargeOne() {
        World small = seedClub(2);
        World large = seedClub(20);
        Authentication platformAdmin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");

        assertThat(statementsFor(platformAdmin, large.club().getId(), null, null, false))
                .isEqualTo(statementsFor(platformAdmin, small.club().getId(), null, null, false));
        assertThat(statementsFor(platformAdmin, large.club().getId(), null, null, true))
                .isEqualTo(statementsFor(platformAdmin, small.club().getId(), null, null, true));
    }

    @Test
    void everyFilterTogetherAndASectionScopedCallerAlsoKeepTheCountConstant() {
        World small = seedClub(2);
        World large = seedClub(20);
        Authentication smallManager = new TestingAuthenticationToken(fixtures.sectionManagerSubject(small.seniors()), "n/a");
        Authentication largeManager = new TestingAuthenticationToken(fixtures.sectionManagerSubject(large.seniors()), "n/a");

        assertThat(statementsFor(largeManager, large.club().getId(), null, large.seniors1().getId(), false))
                .isEqualTo(statementsFor(smallManager, small.club().getId(), null, small.seniors1().getId(), false));

        Authentication platformAdmin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");
        assertThat(statementsFor(platformAdmin, large.club().getId(), large.seniors().getId(), large.seniors1().getId(), true))
                .isEqualTo(statementsFor(platformAdmin, small.club().getId(), small.seniors().getId(), small.seniors1().getId(), true));
    }
}
