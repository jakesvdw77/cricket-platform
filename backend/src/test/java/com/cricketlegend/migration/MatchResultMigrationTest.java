package com.cricketlegend.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Match;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Migration 043 (docs/specs/100-match-results-core.md): it applied (the context booted against Liquibase), one result
 * per match, the import identity is unique per club and source when present, the CHECK constraints hold (a published
 * result needs an outcome, enums are closed, innings ranges), innings sequence is unique per result and deleting a
 * result removes its innings. Not transactional; the shared fixtures clean up.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
class MatchResultMigrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ApplicationContext context;

    private ManagerOverviewFixtures fixtures;
    private World w;
    private Match match;

    @BeforeEach
    void setUp() {
        fixtures = new ManagerOverviewFixtures(context);
        w = fixtures.world();
        match = fixtures.match(w, w.seniors1(), null, Instant.now());
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    private UUID insertResult(Match m, String status, String outcome, String source, String externalId) {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into match_result (id, club_id, match_id, status, outcome_type, source, external_id)"
                + " values (?, ?, ?, ?, ?, ?, ?)", id, w.club().getId(), m.getId(), status, outcome, source, externalId);
        return id;
    }

    @Test
    void tablesExistWithTheDefaultsAManualDraftNeeds() {
        UUID id = insertResult(match, "DRAFT", null, "MANUAL", null);

        assertThat(jdbc.queryForMap("select detail_level, decided_by, balls_per_over from match_result where id = ?", id))
                .containsEntry("detail_level", "SUMMARY")
                .containsEntry("decided_by", "REGULAR")
                .containsEntry("balls_per_over", 6);
        assertThat(jdbc.queryForObject("select count(*) from information_schema.tables where table_name = 'match_innings'",
                Integer.class)).isEqualTo(1);
    }

    @Test
    void aMatchCanHaveOnlyOneResult() {
        insertResult(match, "DRAFT", null, "MANUAL", null);

        assertThatThrownBy(() -> insertResult(match, "DRAFT", null, "MANUAL", null))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void theExternalIdIsUniquePerClubAndSourceButNullsAreFree() {
        Match second = fixtures.match(w, w.seniors1(), null, Instant.now());
        Match third = fixtures.match(w, w.seniors1(), null, Instant.now());
        insertResult(match, "DRAFT", null, "IMPORT:cricclubs", "abc");

        assertThatThrownBy(() -> insertResult(second, "DRAFT", null, "IMPORT:cricclubs", "abc"))
                .isInstanceOf(DataIntegrityViolationException.class);
        // a different source with the same external id, and manual rows without one, are fine
        insertResult(second, "DRAFT", null, "IMPORT:playhq", "abc");
        insertResult(third, "DRAFT", null, "MANUAL", null);
        assertThat(jdbc.queryForObject("select count(*) from match_result where club_id = ?", Integer.class,
                w.club().getId())).isEqualTo(3);
    }

    @Test
    void aPublishedResultNeedsAnOutcome() {
        assertThatThrownBy(() -> insertResult(match, "PUBLISHED", null, "MANUAL", null))
                .isInstanceOf(DataIntegrityViolationException.class);
        insertResult(match, "PUBLISHED", "TIE", "MANUAL", null);
    }

    @Test
    void closedEnumsAndRangesAreEnforced() {
        UUID id = insertResult(match, "DRAFT", null, "MANUAL", null);
        for (String bad : new String[] {
            "update match_result set status = 'ARCHIVED'",
            "update match_result set outcome_type = 'LOST'",
            "update match_result set decided_by = 'COIN'",
            "update match_result set winning_side = 'NORTH'",
            "update match_result set margin_type = 'POINTS'",
            "update match_result set margin_value = -1",
            "update match_result set toss_decision = 'FIELD'",
            "update match_result set balls_per_over = 0",
            "update match_result set detail_level = 'EVERYTHING'"}) {
            assertThatThrownBy(() -> jdbc.update(bad + " where id = ?", id))
                    .as(bad).isInstanceOf(DataIntegrityViolationException.class);
        }
    }

    @Test
    void inningsAreUniquePerSequenceRangeCheckedAndRemovedWithTheirResult() {
        UUID id = insertResult(match, "DRAFT", null, "MANUAL", null);
        String insert = "insert into match_innings (match_result_id, sequence, kind, batting_side, runs, wickets, balls)"
                + " values (?, ?, ?, ?, ?, ?, ?)";
        jdbc.update(insert, id, 1, "REGULAR", "HOME", 150, 10, 120);
        jdbc.update(insert, id, 2, "REGULAR", "AWAY", 151, 3, 100);

        assertThatThrownBy(() -> jdbc.update(insert, id, 2, "REGULAR", "HOME", 1, 1, 6))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update(insert, id, 3, "SUPER_OVER", "HOME", 1, 11, 6))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update(insert, id, 3, "SUPER_OVER", "HOME", -1, 1, 6))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update(insert, id, 3, "SUPER_OVER", "BOTH", 1, 1, 6))
                .isInstanceOf(DataIntegrityViolationException.class);

        jdbc.update("delete from match_result where id = ?", id);
        assertThat(jdbc.queryForObject("select count(*) from match_innings where match_result_id = ?", Integer.class, id))
                .isZero();
    }
}
