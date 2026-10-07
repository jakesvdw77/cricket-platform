package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.AvailabilityPollTypeFilter;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.AvailabilitySummaryDto;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import jakarta.persistence.EntityManagerFactory;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
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
    private final Map<UUID, League> leagueByClubId = new HashMap<>();

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
        League league = fixtures.league(w, 11);
        leagueByClubId.put(w.club().getId(), league);
        PlayerProfile tagged = fixtures.player(w, "Tagged", true);
        fixtures.tag(w.seniors(), tagged);
        for (int i = 0; i < size; i++) {
            boolean juniors = i % 2 == 1;
            PlayerProfile rostered = fixtures.rosterPlayer(w, juniors ? w.juniorsTeam() : w.seniors1(), "Rostered" + i);
            Match match = fixtures.match(
                    w, juniors ? w.juniorsTeam() : w.seniors1(), null, now.plus(Duration.ofDays(2 + i)), true, league);
            fixtures.squadPoll(match, juniors ? w.juniorsTeam() : w.seniors1(),
                    now.plus(Duration.ofHours(10 + i)), rostered);
            if (i % 2 == 0) {
                SectionAvailabilityRound round =
                        fixtures.groupPoll(w, w.seniors(), now.plus(Duration.ofDays(3)).plusSeconds(i), tagged);
                fixtures.linkMatch(round, match);
                // closed history, only read when closed polls are included
                Match past = fixtures.match(w, w.seniors1(), null, now.minus(Duration.ofDays(5 + i)), true, league);
                fixtures.closeSquadPoll(fixtures.squadPoll(past, w.seniors1(), null, rostered));
            }
        }
        return w;
    }

    private long statementsFor(Authentication caller, UUID clubId) {
        return statementsFor(caller, clubId, null, null, null, null, false);
    }

    private long statementsFor(
            Authentication caller,
            UUID clubId,
            UUID leagueId,
            UUID sectionId,
            UUID teamId,
            AvailabilityPollTypeFilter type,
            boolean includeClosed) {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        assertThat(statistics.isStatisticsEnabled()).isTrue();
        statistics.clear();
        AvailabilitySummaryDto result = summaryService.summary(caller, clubId, leagueId, sectionId, teamId, type, includeClosed);
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
        assertThat(summaryService.summary(platformAdmin, large.club().getId(), null, null, null, null, false).openPolls()).isEqualTo(14 + 7);
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

    @Test
    void everyFilterTogetherAlsoKeepsTheStatementCountConstant() {
        World small = seedClub(2);
        World large = seedClub(14);
        Authentication platformAdmin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");

        long smallCount = statementsFor(platformAdmin, small.club().getId(),
                leagueByClubId.get(small.club().getId()).getId(), small.seniors().getId(), small.seniors1().getId(),
                AvailabilityPollTypeFilter.ALL, true);
        long largeCount = statementsFor(platformAdmin, large.club().getId(),
                leagueByClubId.get(large.club().getId()).getId(), large.seniors().getId(), large.seniors1().getId(),
                AvailabilityPollTypeFilter.ALL, true);

        assertThat(largeCount).isEqualTo(smallCount);
    }

    @Test
    void leagueAndClosedFiltersOnASectionScopedCallerKeepTheStatementCountConstant() {
        World small = seedClub(2);
        World large = seedClub(14);
        Authentication smallManager =
                new TestingAuthenticationToken(fixtures.sectionManagerSubject(small.seniors()), "n/a");
        Authentication largeManager =
                new TestingAuthenticationToken(fixtures.sectionManagerSubject(large.seniors()), "n/a");

        long smallCount = statementsFor(smallManager, small.club().getId(),
                leagueByClubId.get(small.club().getId()).getId(), null, null, null, true);
        long largeCount = statementsFor(largeManager, large.club().getId(),
                leagueByClubId.get(large.club().getId()).getId(), null, null, null, true);

        assertThat(largeCount).isEqualTo(smallCount);
    }
}
