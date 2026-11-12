package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.AbstractLinkIntegrationTest;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.support.PlayerStatsSeed;
import jakarta.persistence.EntityManagerFactory;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * N+1 guard for docs/specs/147 ("a fixed number of queries per page, none per row"): My stats, the match drill, Team
 * stats and a leaderboard page issue the same number of SQL statements for a small club as for one in which the player
 * has 25 more results and the league has 25 more players. Same technique as {@code PlayerMatchListQueryCountIntegrationTest}.
 * Not transactional.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class MePlayerStatsQueryCountIntegrationTest extends AbstractLinkIntegrationTest {

    /** A safety net over the equality check: the reads are a handful of statements, not hundreds. */
    private static final long GENEROUS_CEILING = 150;

    @Autowired private MockMvc mockMvc;
    @Autowired private EntityManagerFactory entityManagerFactory;
    @Autowired private ApplicationContext context;
    @Autowired private JdbcTemplate jdbc;

    private final List<PlayerStatsSeed> seeds = new ArrayList<>();
    private final List<UUID> accounts = new ArrayList<>();
    private final List<UUID> links = new ArrayList<>();

    private Club small;
    private Club large;

    @BeforeEach
    void seedBoth() {
        small = club(false);
        large = club(true);
    }

    private record Club(PlayerStatsSeed seed, Person parent, String key) {
    }

    private Club club(boolean large) {
        PlayerStatsSeed seed = new PlayerStatsSeed(context);
        seed.seedMatchList();
        if (large) {
            seed.addMatchesFor(seed.alice, 25);
            seed.addBulk(25);
        }
        jdbc.update("update match_result set visible_to_players = true where club_id = ?", seed.w.club().getId());
        seeds.add(seed);
        Person parent = account("Pat", "Parent");
        accounts.add(parent.getId());
        Person subject = personRepository.findById(seed.alice.getPersonId()).orElseThrow();
        PersonLink l = link(parent, subject, seed.w.club(), true);
        links.add(l.getId());
        return new Club(seed, parent, l.getId().toString());
    }

    @AfterEach
    void cleanUp() {
        links.forEach(id -> jdbc.update("delete from person_link where id = ?", id));
        accounts.forEach(id -> jdbc.update("delete from person where id = ?", id));
        seeds.forEach(PlayerStatsSeed::cleanUp);
    }

    private long statements(Club club, String path) throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        assertThat(statistics.isStatisticsEnabled()).isTrue();
        statistics.clear();
        mockMvc.perform(get("/api/v1/me/players/{k}" + path, club.key()).with(as(club.parent())))
                .andExpect(status().isOk());
        return statistics.getPrepareStatementCount();
    }

    private void sameCountForSmallAndLarge(String name, java.util.function.Function<Club, String> path) throws Exception {
        // a warm-up read each, so one-off lazy loads (caches, class loading) do not decide the comparison
        statements(small, path.apply(small));
        statements(large, path.apply(large));
        long smallCount = statements(small, path.apply(small));
        long largeCount = statements(large, path.apply(large));
        assertThat(largeCount).as(name + ": a club with 25 more results and players issues the same statements").isEqualTo(smallCount);
        assertThat(smallCount).as(name + " statements").isBetween(1L, GENEROUS_CEILING);
    }

    @Test
    void myStatsIssuesAFixedNumberOfStatements() throws Exception {
        sameCountForSmallAndLarge("stats", c -> "/stats");
        sameCountForSmallAndLarge("stats with every filter", c -> "/stats?seasonId=" + c.seed().s1.getId() + "&leagueId="
                + c.seed().l1.getId() + "&teamId=" + c.seed().w.seniors1().getId());
    }

    @Test
    void theMatchDrillIssuesAFixedNumberOfStatementsForEveryKindAndPage() throws Exception {
        for (String kind : List.of("BATTING", "BOWLING", "FIELDING", "MATCHES")) {
            sameCountForSmallAndLarge("drill " + kind, c -> "/stats/innings?kind=" + kind + "&size=20");
        }
        sameCountForSmallAndLarge("drill filtered", c -> "/stats/innings?kind=BATTING&filter=BAND_10_29&page=1&size=5");
    }

    @Test
    void teamStatsIssuesAFixedNumberOfStatements() throws Exception {
        sameCountForSmallAndLarge("team-stats", c -> "/team-stats?teamId=" + c.seed().w.seniors1().getId());
        sameCountForSmallAndLarge("team-stats scoped", c -> "/team-stats?teamId=" + c.seed().w.seniors1().getId()
                + "&seasonId=" + c.seed().s1.getId());
    }

    @Test
    void aLeaderboardPageIssuesAFixedNumberOfStatements() throws Exception {
        sameCountForSmallAndLarge("batting page", c -> "/leaderboards/batting?size=20");
        sameCountForSmallAndLarge("bowling page 2", c -> "/leaderboards/bowling?size=5&page=1&sort=wickets&direction=desc");
        sameCountForSmallAndLarge("fielding page", c -> "/leaderboards/fielding?size=20");
        sameCountForSmallAndLarge("standing", c -> "/leaderboards/standing");
    }
}
