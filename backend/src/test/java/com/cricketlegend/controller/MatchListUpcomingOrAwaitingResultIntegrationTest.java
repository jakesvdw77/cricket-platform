package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Match;
import com.cricketlegend.dto.MatchDto;
import com.cricketlegend.dto.MatchesSummaryDto;
import com.cricketlegend.service.MatchService;
import com.cricketlegend.service.support.ServerClock;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/132-match-scheduling-rules.md Part B against real Postgres: {@code upcomingOnly} is today onward plus
 * active past matches without a published result (none, or a draft); the summary counters ask the same filter.
 * Deliberately not {@code @Transactional}; the fixtures remove what they seed.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
class MatchListUpcomingOrAwaitingResultIntegrationTest {

    private final Authentication admin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");

    @Autowired
    private ApplicationContext context;

    @Autowired
    private MatchService matchService;

    @Autowired
    private JdbcTemplate jdbc;

    private ManagerOverviewFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new ManagerOverviewFixtures(context);
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    private void result(Match match, UUID clubId, String status) {
        jdbc.update("insert into match_result (id, club_id, match_id, status, detail_level, outcome_type, winning_side,"
                        + " balls_per_over, published_at) values (?, ?, ?, ?, 'FULL', 'WON', 'HOME', 6, ?)",
                UUID.randomUUID(), clubId, match.getId(), status,
                "PUBLISHED".equals(status) ? Timestamp.from(Instant.now()) : null);
    }

    private List<UUID> ids(World w, boolean upcomingOnly) {
        return matchService.list(admin, w.club().getId(), null, upcomingOnly, null, null, null, null, null, null, null,
                PageRequest.of(0, 50)).getContent().stream().map(MatchDto::id).toList();
    }

    @Test
    void theDefaultKeepsTodayOnwardAndPastMatchesStillNeedingAResultAndHidesTheRest() {
        World w = fixtures.world();
        Instant today = ServerClock.startOfToday().plusSeconds(60);
        Instant past = ServerClock.startOfToday().minusSeconds(2 * 86_400);
        Match todays = fixtures.match(w, w.seniors1(), null, today);
        Match future = fixtures.match(w, w.seniors1(), null, today.plusSeconds(3 * 86_400));
        Match pastNoResult = fixtures.match(w, w.seniors1(), null, past);
        Match pastDraft = fixtures.match(w, w.seniors1(), null, past.minusSeconds(86_400));
        Match pastPublished = fixtures.match(w, w.seniors1(), null, past.minusSeconds(2 * 86_400));
        Match pastInactive = fixtures.match(w, w.seniors1(), null, past.minusSeconds(3 * 86_400), false, null);
        result(pastDraft, w.club().getId(), "DRAFT");
        result(pastPublished, w.club().getId(), "PUBLISHED");

        assertThat(ids(w, true)).containsExactlyInAnyOrder(
                todays.getId(), future.getId(), pastNoResult.getId(), pastDraft.getId());
        assertThat(ids(w, false)).containsExactlyInAnyOrder(todays.getId(), future.getId(), pastNoResult.getId(),
                pastDraft.getId(), pastPublished.getId(), pastInactive.getId());
    }

    @Test
    void aPublishedPastMatchWithAnUpcomingDateOrTodayStaysVisible() {
        World w = fixtures.world();
        Match todayPublished = fixtures.match(w, w.seniors1(), null, ServerClock.startOfToday().plusSeconds(60));
        result(todayPublished, w.club().getId(), "PUBLISHED");

        assertThat(ids(w, true)).containsExactly(todayPublished.getId());
    }

    @Test
    void theSummaryCountersUseTheSameFilterAsTheList() {
        World w = fixtures.world();
        Instant past = ServerClock.startOfToday().minusSeconds(2 * 86_400);
        fixtures.match(w, w.seniors1(), null, ServerClock.startOfToday().plusSeconds(60));
        fixtures.match(w, w.seniors1(), null, past);
        Match published = fixtures.match(w, w.seniors1(), null, past.minusSeconds(86_400));
        result(published, w.club().getId(), "PUBLISHED");

        MatchesSummaryDto upcoming = matchService.summary(
                admin, w.club().getId(), null, null, null, null, null, null, false, null);
        MatchesSummaryDto everything = matchService.summary(
                admin, w.club().getId(), null, null, null, null, null, null, true, null);

        assertThat(upcoming.matchesShown()).isEqualTo(ids(w, true).size()).isEqualTo(2);
        assertThat(everything.matchesShown()).isEqualTo(ids(w, false).size()).isEqualTo(3);
    }
}
