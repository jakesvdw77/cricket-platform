package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.TeamSelectionOverviewDto;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import jakarta.persistence.EntityManagerFactory;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
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
 * N+1 guard for docs/specs/093-team-selection-hub.md: {@code TeamSelectionService.overview} issues
 * the same number of SQL statements for a club with a handful of matches and players as for one with
 * many, with every data shape present in both (squad poll, group poll, league with an age rule,
 * sides with picks, a derby, past matches). Not {@code @Transactional}; rows are removed in
 * {@code @AfterEach}. Same technique as {@code MatchesSummaryQueryCountIntegrationTest}.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@Import(AbstractIntegrationTest.class)
class TeamSelectionQueryCountIntegrationTest {

    @Autowired
    private TeamSelectionService teamSelectionService;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private LeagueRepository leagueRepository;

    @Autowired
    private PlayerAvailabilityRepository playerAvailabilityRepository;

    private ManagerOverviewFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new ManagerOverviewFixtures(context);
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    /** {@code extra} more matches and players than the fixed set of four matches that carries every shape. */
    private World seedClub(int extra) {
        World w = fixtures.world();
        League league = leagueRepository.save(League.builder().clubId(w.club().getId()).name("U20 " + UUID.randomUUID())
                .source(LeagueSource.INTERNAL).maxPlayingXiSize(11).maxAge(60).active(true).build());
        List<PlayerProfile> players = new ArrayList<>();
        for (int i = 0; i < 3 + extra; i++) {
            PlayerProfile player = fixtures.rosterPlayer(w, i % 2 == 0 ? w.seniors1() : w.seniors2(), "P" + i);
            fixtures.tag(w.seniors(), player);
            players.add(player);
        }
        Instant base = Instant.now().plus(Duration.ofDays(2));

        Match squadPolled = fixtures.match(w, w.seniors1(), null, base);
        var poll = fixtures.squadPoll(squadPolled, w.seniors1(), null, players.get(0));
        playerAvailabilityRepository.save(PlayerAvailability.builder().pollId(poll.getId())
                .playerProfileId(players.get(2).getId()).status(AvailabilityStatus.UNAVAILABLE).build());
        fixtures.side(squadPolled, w.seniors1(), false, players.get(0));

        Match groupPolled = fixtures.match(w, w.seniors2(), null, base.plus(Duration.ofDays(1)), true, league);
        fixtures.linkMatch(fixtures.groupPoll(w, w.seniors(), null, players.get(1)), groupPolled);
        fixtures.side(groupPolled, w.seniors2(), true, players.get(1));

        Match derby = fixtures.match(w, w.seniors1(), w.seniors2(), base.plus(Duration.ofDays(2)));
        fixtures.side(derby, w.seniors1(), false, players.get(2));
        fixtures.side(derby, w.seniors2(), false);

        fixtures.match(w, w.seniors1(), null, base.minus(Duration.ofDays(30)));

        for (int i = 0; i < extra; i++) {
            Match match = fixtures.match(w, i % 2 == 0 ? w.seniors1() : w.seniors2(), null,
                    base.plus(Duration.ofDays(3 + i)), true, i % 3 == 0 ? league : null);
            fixtures.side(match, i % 2 == 0 ? w.seniors1() : w.seniors2(), false, players.get(3 + i));
        }
        return w;
    }

    private long statementsFor(Authentication caller, World w, UUID sectionId, boolean includePast) {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        assertThat(statistics.isStatisticsEnabled()).isTrue();
        statistics.clear();
        TeamSelectionOverviewDto result =
                teamSelectionService.overview(caller, w.club().getId(), null, null, sectionId, null, includePast);
        assertThat(result.matches()).isNotEmpty();
        assertThat(result.players()).isNotEmpty();
        return statistics.getPrepareStatementCount();
    }

    @Test
    void overviewIssuesTheSameNumberOfStatementsForASmallClubAsForALargeOne() {
        World small = seedClub(0);
        World large = seedClub(25);
        Authentication admin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");

        assertThat(statementsFor(admin, large, null, false)).isEqualTo(statementsFor(admin, small, null, false));
        assertThat(statementsFor(admin, large, null, true)).isEqualTo(statementsFor(admin, small, null, true));
        assertThat(statementsFor(admin, large, large.seniors().getId(), true))
                .isEqualTo(statementsFor(admin, small, small.seniors().getId(), true));
    }

    @Test
    void aSectionScopedCallerKeepsTheCountConstantToo() {
        World small = seedClub(0);
        World large = seedClub(25);
        Authentication smallManager = new TestingAuthenticationToken(fixtures.sectionManagerSubject(small.seniors()), "n/a");
        Authentication largeManager = new TestingAuthenticationToken(fixtures.sectionManagerSubject(large.seniors()), "n/a");

        assertThat(statementsFor(largeManager, large, null, true)).isEqualTo(statementsFor(smallManager, small, null, true));
    }
}
