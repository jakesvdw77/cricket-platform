package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.SectionAvailabilityWindowMatch;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import jakarta.persistence.EntityManagerFactory;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
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
 * N+1 guard for the {@code canReopen} flag (docs/specs/082-poll-card-improvements.md): listing the
 * closed squad polls and the group rounds never loads a {@code Match} (or round window) one by one:
 * the match, window and window-match rows come from batched queries. The surrounding per-poll squad/response resolution pre-dates 082 and is not
 * what is measured. Deliberately NOT {@code @Transactional}; hibernate statistics are switched on
 * for this class only (same technique as {@code LeagueListQueryCountIntegrationTest}).
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@Import(AbstractIntegrationTest.class)
class ReopenWindowQueryCountIntegrationTest {

    @Autowired
    private MatchAvailabilityPollService pollService;

    @Autowired
    private SectionAvailabilityRoundService roundService;

    @Autowired
    private MatchAvailabilityPollRepository pollRepository;

    @Autowired
    private SectionAvailabilityRoundRepository roundRepository;

    @Autowired
    private SectionAvailabilityWindowRepository windowRepository;

    @Autowired
    private SectionAvailabilityWindowMatchRepository windowMatchRepository;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Autowired
    private ApplicationContext context;

    private ManagerOverviewFixtures fixtures;
    private int dateCounter;

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
        for (int i = 0; i < size; i++) {
            Match match = fixtures.match(w, w.seniors1(), null, Instant.now().minus(Duration.ofHours(1 + i)));
            MatchAvailabilityPoll poll = fixtures.squadPoll(match, w.seniors1(), null);
            poll.setOpen(false);
            poll.setAutoClose(false);
            pollRepository.save(poll);

            LocalDate date = LocalDate.of(2031, 1, 1).plusDays(dateCounter++);
            SectionAvailabilityRound round = roundRepository.save(SectionAvailabilityRound.builder()
                    .clubId(w.club().getId()).sectionId(w.seniors().getId()).description("Round " + i)
                    .firstMatchDate(date).lastMatchDate(date).autoClose(false).open(false).build());
            for (int k = 0; k < 2; k++) {
                SectionAvailabilityWindow window = windowRepository.save(SectionAvailabilityWindow.builder()
                        .clubId(w.club().getId()).sectionId(w.seniors().getId()).roundId(round.getId())
                        .windowDate(date.plusDays(100L * (k + 1))).dayPart(DayPart.MORNING).open(false).build());
                Match windowMatch = fixtures.match(
                        w, w.seniors1(), null, Instant.now().minus(Duration.ofHours(2 + i + k)));
                windowMatchRepository.save(SectionAvailabilityWindowMatch.builder()
                        .windowId(window.getId()).matchId(windowMatch.getId()).build());
            }
        }
        return w;
    }

    private Statistics statistics() {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        assertThat(statistics.isStatisticsEnabled()).isTrue();
        statistics.clear();
        return statistics;
    }

    @Test
    void theClosedPollListingNeverFetchesMatchesOneByOne() {
        World w = seedClub(6);
        Authentication admin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");
        Statistics statistics = statistics();

        var polls = pollService.listClosedForClub(admin, w.club().getId(), null, null, null, null);

        assertThat(polls).hasSize(6).allMatch(p -> p.canReopen());
        assertThat(statistics.getEntityStatistics(Match.class.getName()).getFetchCount()).isZero();
    }

    @Test
    void theRoundListingNeverFetchesMatchesOrWindowsOneByOne() {
        World w = seedClub(7);
        Authentication admin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");
        Statistics statistics = statistics();

        var rounds = roundService.list(admin, w.club().getId(), null, null, null, null, false);

        assertThat(rounds).hasSize(7).allMatch(r -> r.canReopen());
        assertThat(statistics.getEntityStatistics(Match.class.getName()).getFetchCount()).isZero();
        assertThat(statistics.getEntityStatistics(SectionAvailabilityWindow.class.getName()).getFetchCount())
                .isZero();
    }
}
