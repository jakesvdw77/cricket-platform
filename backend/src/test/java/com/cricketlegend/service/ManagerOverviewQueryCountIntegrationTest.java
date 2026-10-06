package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.ManagerOverviewDto;
import com.cricketlegend.service.support.ServerClock;
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
 * N+1 guard for docs/specs/079-manager-shell-and-overview.md: {@code ManagerOverviewService.overview}
 * issues the same number of SQL statements for a club with a handful of matches, polls and players
 * as for one with several times as many (every kind of data present in both, so the same batched
 * queries run). Run for an unrestricted caller and for a section-scoped one. Deliberately NOT
 * {@code @Transactional} (docs/standards/backend.md): the service method's own transaction is what
 * is measured, and rows are removed in {@code @AfterEach}. Hibernate statistics are not on by
 * default, so they are enabled for this test class only (same technique as
 * {@code LeagueListQueryCountIntegrationTest}).
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@Import(AbstractIntegrationTest.class)
class ManagerOverviewQueryCountIntegrationTest {

    @Autowired
    private ManagerOverviewService overviewService;

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

    /** {@code size} week matches (each with a side, selected players, a squad poll) plus group polls and players. */
    private World seedClub(int size) {
        World w = fixtures.world();
        League league = fixtures.league(w, 11);
        Instant today = ServerClock.startOfToday();
        PlayerProfile tagged = fixtures.player(w, "Tagged", true);
        fixtures.tag(w.seniors(), tagged);
        for (int i = 0; i < size; i++) {
            PlayerProfile rostered = fixtures.rosterPlayer(w, w.seniors1(), "Rostered" + i);
            fixtures.tag(w.seniors(), rostered);
            Match match = fixtures.match(
                    w, w.seniors1(), i % 2 == 0 ? w.juniorsTeam() : null,
                    today.plus(Duration.ofHours(1 + i * 5)), true, i % 3 == 0 ? league : null);
            fixtures.side(match, w.seniors1(), i % 2 == 0, tagged, rostered);
            fixtures.squadPoll(match, w.seniors1(), today.plus(Duration.ofDays(1)).plusSeconds(i), rostered);
            if (i % 2 == 0) {
                fixtures.groupPoll(w, w.seniors(), today.plus(Duration.ofDays(2)).plusSeconds(i), tagged);
            }
        }
        return w;
    }

    private long statementsFor(Authentication caller, UUID clubId) {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        assertThat(statistics.isStatisticsEnabled()).isTrue();
        statistics.clear();
        ManagerOverviewDto result = overviewService.overview(caller, clubId);
        assertThat(result.matchesThisWeek()).isPositive();
        return statistics.getPrepareStatementCount();
    }

    @Test
    void overviewIssuesTheSameNumberOfStatementsForASmallClubAsForALargeOne() {
        World small = seedClub(2);
        World large = seedClub(14);
        Authentication platformAdmin =
                new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");

        long smallCount = statementsFor(platformAdmin, small.club().getId());
        long largeCount = statementsFor(platformAdmin, large.club().getId());

        assertThat(largeCount).isEqualTo(smallCount);
        ManagerOverviewDto result = overviewService.overview(platformAdmin, large.club().getId());
        assertThat(result.matchesThisWeek()).isEqualTo(14);
        assertThat(result.upcomingMatches()).hasSize(5);
        assertThat(result.openPolls()).hasSize(5);
    }

    @Test
    void aSectionScopedCallerAlsoGetsABoundedStatementCount() {
        World small = seedClub(2);
        World large = seedClub(14);
        Authentication smallManager = new TestingAuthenticationToken(
                fixtures.sectionManagerSubject(small.seniors()), "n/a");
        Authentication largeManager = new TestingAuthenticationToken(
                fixtures.sectionManagerSubject(large.seniors()), "n/a");

        long smallCount = statementsFor(smallManager, small.club().getId());
        long largeCount = statementsFor(largeManager, large.club().getId());

        assertThat(largeCount).isEqualTo(smallCount);
    }
}
