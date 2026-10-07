package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.AvailabilitySummaryDto;
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
 * N+1 guard for docs/specs/081-plain-page-header-and-counters.md: {@code
 * AvailabilitySummaryService.summary} issues the same number of SQL statements for a club with a
 * few polls as for one with many (squad polls of two teams and group polls present in both). Not
 * {@code @Transactional}; rows are removed in {@code @AfterEach}. Same technique as {@code
 * ManagerOverviewQueryCountIntegrationTest}.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@Import(AbstractIntegrationTest.class)
class AvailabilitySummaryQueryCountIntegrationTest {

    @Autowired
    private AvailabilitySummaryService summaryService;

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
        PlayerProfile tagged = fixtures.player(w, "Tagged", true);
        fixtures.tag(w.seniors(), tagged);
        for (int i = 0; i < size; i++) {
            boolean juniors = i % 2 == 1;
            PlayerProfile rostered = fixtures.rosterPlayer(w, juniors ? w.juniorsTeam() : w.seniors1(), "Rostered" + i);
            Match match = fixtures.match(
                    w, juniors ? w.juniorsTeam() : w.seniors1(), null, now.plus(Duration.ofDays(2 + i)));
            fixtures.squadPoll(match, juniors ? w.juniorsTeam() : w.seniors1(),
                    now.plus(Duration.ofHours(10 + i)), rostered);
            if (i % 2 == 0) {
                fixtures.groupPoll(w, w.seniors(), now.plus(Duration.ofDays(3)).plusSeconds(i), tagged);
            }
        }
        return w;
    }

    private long statementsFor(Authentication caller, UUID clubId) {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        assertThat(statistics.isStatisticsEnabled()).isTrue();
        statistics.clear();
        AvailabilitySummaryDto result = summaryService.summary(caller, clubId);
        assertThat(result.openPolls()).isPositive();
        return statistics.getPrepareStatementCount();
    }

    @Test
    void summaryIssuesTheSameNumberOfStatementsForASmallClubAsForALargeOne() {
        World small = seedClub(2);
        World large = seedClub(14);
        Authentication platformAdmin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");

        long smallCount = statementsFor(platformAdmin, small.club().getId());
        long largeCount = statementsFor(platformAdmin, large.club().getId());

        assertThat(largeCount).isEqualTo(smallCount);
        assertThat(summaryService.summary(platformAdmin, large.club().getId()).openPolls()).isEqualTo(14 + 7);
    }

    @Test
    void aSectionScopedCallerAlsoGetsABoundedStatementCount() {
        World small = seedClub(2);
        World large = seedClub(14);
        Authentication smallManager =
                new TestingAuthenticationToken(fixtures.sectionManagerSubject(small.seniors()), "n/a");
        Authentication largeManager =
                new TestingAuthenticationToken(fixtures.sectionManagerSubject(large.seniors()), "n/a");

        long smallCount = statementsFor(smallManager, small.club().getId());
        long largeCount = statementsFor(largeManager, large.club().getId());

        assertThat(largeCount).isEqualTo(smallCount);
    }
}
