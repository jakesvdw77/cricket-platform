package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Season;
import com.cricketlegend.dto.DuplicateLeagueRequest;
import com.cricketlegend.dto.DuplicateLeagueResponse;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CopyOnWriteArrayList;
import org.hibernate.resource.jdbc.spi.StatementInspector;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;

/**
 * N+1 guard for docs/specs/096-duplicate-league.md: {@code LeagueService.duplicate} issues the same number of SELECTs for
 * a small source (1 season, 2 contacts) as for a large one (3 seasons, 20 contacts). A Hibernate statement inspector
 * records every SQL string, so the guard counts SELECTs only (the INSERTs legitimately grow with the copied rows). Not
 * {@code @Transactional}; rows are removed in {@code @AfterEach}.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.session_factory.statement_inspector="
        + "com.cricketlegend.service.LeagueDuplicateQueryCountIntegrationTest$RecordingInspector")
@Import(AbstractIntegrationTest.class)
class LeagueDuplicateQueryCountIntegrationTest {

    /** Records every SQL statement Hibernate prepares; test-only. */
    public static class RecordingInspector implements StatementInspector {
        static final List<String> STATEMENTS = new CopyOnWriteArrayList<>();

        @Override
        public String inspect(String sql) {
            STATEMENTS.add(sql);
            return sql;
        }
    }

    @Autowired
    private LeagueService leagueService;

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

    private record Seeded(World w, League source, List<Season> seasons) {
    }

    private Seeded seed(int seasonCount, int contactCount) {
        World w = fixtures.world();
        League source = fixtures.leagueWithProfile(w, "Source " + seasonCount, true);
        List<Season> seasons = new ArrayList<>();
        seasons.add(w.season());
        for (int i = 1; i < seasonCount; i++) {
            seasons.add(fixtures.season(w.club(), "Extra " + i));
        }
        for (Season season : seasons) {
            fixtures.playingConditions(source, season);
        }
        for (int i = 0; i < contactCount; i++) {
            fixtures.contact(source, "Contact" + i, "Role", i == 0, true);
        }
        return new Seeded(w, source, seasons);
    }

    private long selectsFor(Seeded seeded) {
        List<java.util.UUID> seasonIds = seeded.seasons().stream().map(Season::getId).toList();
        RecordingInspector.STATEMENTS.clear();
        DuplicateLeagueResponse response = leagueService.duplicate(seeded.w().club().getId(), seeded.source().getId(),
                new DuplicateLeagueRequest("Copy " + seasonIds.size(), seasonIds, true, true));
        List<String> statements = new ArrayList<>(RecordingInspector.STATEMENTS);
        assertThat(response.playingConditionsCopied()).isEqualTo(seasonIds.size());
        return statements.stream().filter(sql -> sql.stripLeading().toLowerCase(Locale.ROOT).startsWith("select")).count();
    }

    @Test
    void duplicateIssuesTheSameNumberOfSelectsForASmallSourceAsForALargeOne() {
        Seeded small = seed(1, 2);
        Seeded large = seed(3, 20);

        long smallSelects = selectsFor(small);
        long largeSelects = selectsFor(large);

        assertThat(smallSelects).isPositive();
        assertThat(largeSelects).isEqualTo(smallSelects);
    }
}
