package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.PlayersSummaryDto;
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
 * N+1 guard for docs/specs/088-players-polls-alignment.md: {@code PlayerService.summary} issues the same number of SQL
 * statements for a club with a few players as for one with many (the roster, its section links, and one query each for
 * the squad and the selection; never a lookup per player). Not {@code @Transactional}; rows are removed in
 * {@code @AfterEach}. Same technique as {@code MatchesSummaryQueryCountIntegrationTest}.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@Import(AbstractIntegrationTest.class)
class PlayersSummaryQueryCountIntegrationTest {

    @Autowired
    private PlayerService playerService;

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
            var team = i % 2 == 0 ? w.seniors1() : w.juniorsTeam();
            var section = i % 2 == 0 ? w.seniors() : w.juniors();
            PlayerProfile player = fixtures.rosterPlayer(w, team, "Player" + i);
            fixtures.tag(section, player);
            if (i % 3 == 0) {
                Match match = fixtures.match(w, team, null, now.plus(Duration.ofDays(1 + i)));
                fixtures.side(match, team, false, player);
            }
        }
        return w;
    }

    private long statementsFor(Authentication caller, World w, UUID sectionId, boolean includeInactive) {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        assertThat(statistics.isStatisticsEnabled()).isTrue();
        statistics.clear();
        PlayersSummaryDto result =
                playerService.summary(caller, w.club().getId(), sectionId, false, includeInactive, w.season().getId());
        assertThat(result.playersShown()).isPositive();
        return statistics.getPrepareStatementCount();
    }

    @Test
    void summaryIssuesTheSameNumberOfStatementsForASmallClubAsForALargeOne() {
        World small = seedClub(3);
        World large = seedClub(30);
        Authentication platformAdmin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");

        assertThat(statementsFor(platformAdmin, large, null, true)).isEqualTo(statementsFor(platformAdmin, small, null, true));
        assertThat(statementsFor(platformAdmin, large, large.seniors().getId(), false))
                .isEqualTo(statementsFor(platformAdmin, small, small.seniors().getId(), false));
    }

    @Test
    void aSectionScopedCallerAlsoKeepsTheCountConstant() {
        World small = seedClub(3);
        World large = seedClub(30);
        Authentication smallManager = new TestingAuthenticationToken(fixtures.sectionManagerSubject(small.seniors()), "n/a");
        Authentication largeManager = new TestingAuthenticationToken(fixtures.sectionManagerSubject(large.seniors()), "n/a");

        assertThat(statementsFor(largeManager, large, null, false)).isEqualTo(statementsFor(smallManager, small, null, false));
    }

    // docs/specs/088: the list (with the games played for every player) is also a fixed number of statements
    @Test
    void theListWithGamesPlayedIssuesTheSameNumberOfStatementsForASmallClubAsForALargeOne() {
        World small = seedClub(3);
        World large = seedClub(30);
        Authentication platformAdmin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");

        assertThat(listStatements(platformAdmin, large)).isEqualTo(listStatements(platformAdmin, small));
    }

    private long listStatements(Authentication caller, World w) {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        var players = playerService.list(caller, w.club().getId(), null, false, true, null, w.season().getId());
        assertThat(players).isNotEmpty();
        return statistics.getPrepareStatementCount();
    }
}
