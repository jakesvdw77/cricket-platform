package com.cricketlegend.migration;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.UUID;
import liquibase.Contexts;
import liquibase.LabelExpression;
import liquibase.Liquibase;
import liquibase.database.Database;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * Migrations 061 and 062 (docs/specs/145 Player Hub results, Decision 2 as amended: a published result shows in the
 * Player Hub) applied over a database that already holds match results. Same technique as
 * {@link ResultImportMigrationOverEarlierDataTest}: Liquibase driven directly against a raw Testcontainers Postgres, first
 * through test-only changelogs that stop at 060 and then at 061.
 *
 * <p>061 adds the three columns with every earlier row off; 062 switches on exactly the published rows, with their
 * publisher and publish time; a draft (including one that was never published) stays off; running Liquibase again is a
 * no-op, so a manager's later "Hide From Player Hub" survives a restart.
 */
@Testcontainers
class ResultVisibleToPlayersMigrationOverEarlierDataTest {

    @Container
    PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    private static void migrate(Database database, String changelog) throws Exception {
        new Liquibase(changelog, new ClassLoaderResourceAccessor(), database).update(new Contexts(), new LabelExpression());
    }

    @Test
    void migration061AddsTheColumnsOffAndMigration062SwitchesOnOnlyThePublishedResults() throws Exception {
        try (Connection c = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            Database database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));

            // ---- 060 data ----
            migrate(database, "db/changelog/changelog-through-060-test-only.xml");
            c.setAutoCommit(true);
            assertThat(count(c, "select count(*) from information_schema.columns where table_name = 'match_result'"
                    + " and column_name like 'visible_to_players%'")).isZero();
            UUID club = insert(c, "insert into club (id, name, slug, status) values (?, 'Riverside CC', 'riverside', 'ACTIVE')");
            UUID otherClub = insert(c, "insert into club (id, name, slug, status) values (?, 'Hilltop CC', 'hilltop', 'ACTIVE')");
            UUID season = insert(c, "insert into season (id, club_id, label, start_date, end_date) values (?, '" + club + "', '2026', '2026-01-01', '2026-12-31')");
            UUID section = insert(c, "insert into section (id, club_id, name) values (?, '" + club + "', 'Seniors')");
            UUID team = insert(c, "insert into team (id, club_id, section_id, name) values (?, '" + club + "', '" + section + "', '1st XI')");
            UUID publisher = insert(c, "insert into person (id, first_name, last_name, email) values (?, 'Pat', 'Publisher', 'pat@example.com')");
            UUID published = result(c, club, season, team, "PUBLISHED", "'2026-03-01T10:00:00Z'", "'" + publisher + "'");
            UUID publishedImported = result(c, club, season, team, "PUBLISHED", "'2026-03-02T10:00:00Z'", "null");
            UUID draft = result(c, club, season, team, "DRAFT", "null", "null");
            // an unpublished result: back to DRAFT with nothing left of the publish
            UUID unpublished = result(c, club, season, team, "DRAFT", "null", "null");
            // another club's published result is switched on as well (the rule is not per club)
            UUID otherSeason = insert(c, "insert into season (id, club_id, label, start_date, end_date) values (?, '" + otherClub + "', '2026', '2026-01-01', '2026-12-31')");
            UUID otherSection = insert(c, "insert into section (id, club_id, name) values (?, '" + otherClub + "', 'Seniors')");
            UUID otherTeam = insert(c, "insert into team (id, club_id, section_id, name) values (?, '" + otherClub + "', '" + otherSection + "', '1st XI')");
            UUID otherPublished = result(c, otherClub, otherSeason, otherTeam, "PUBLISHED", "'2026-03-03T10:00:00Z'", "null");

            // ---- 061 applies: the columns exist, every earlier row is off ----
            migrate(database, "db/changelog/changelog-through-061-test-only.xml");
            c.setAutoCommit(true);
            assertThat(count(c, "select count(*) from information_schema.columns where table_name = 'match_result'"
                    + " and column_name in ('visible_to_players', 'visible_to_players_at', 'visible_to_players_by')")).isEqualTo(3);
            assertThat(single(c, "select is_nullable from information_schema.columns where table_name = 'match_result' and column_name = 'visible_to_players'"))
                    .isEqualTo("NO");
            assertThat(count(c, "select count(*) from match_result")).isEqualTo(5);
            assertThat(count(c, "select count(*) from match_result where visible_to_players")).isZero();
            assertThat(count(c, "select count(*) from match_result where visible_to_players_at is not null or visible_to_players_by is not null")).isZero();

            // ---- 062 applies (the whole master changelog) ----
            migrate(database, "db/changelog/db.changelog-master.xml");
            c.setAutoCommit(true);
            assertThat(visible(c, published)).isTrue();
            assertThat(visible(c, publishedImported)).isTrue();
            assertThat(visible(c, otherPublished)).isTrue();
            assertThat(visible(c, draft)).isFalse();
            assertThat(visible(c, unpublished)).isFalse();
            assertThat(count(c, "select count(*) from match_result where visible_to_players")).isEqualTo(3);
            // with the publisher and the publish time, so the "who and when" is never empty for a switched-on result
            assertThat(single(c, "select visible_to_players_by::text from match_result where id = '" + published + "'")).isEqualTo(publisher.toString());
            assertThat(count(c, "select count(*) from match_result where id = '" + published + "' and visible_to_players_at = published_at")).isEqualTo(1);
            assertThat(single(c, "select visible_to_players_by from match_result where id = '" + publishedImported + "'")).isNull();
            assertThat(count(c, "select count(*) from match_result where id = '" + publishedImported + "' and visible_to_players_at = published_at")).isEqualTo(1);
            assertThat(count(c, "select count(*) from match_result where not visible_to_players and (visible_to_players_at is not null or visible_to_players_by is not null)")).isZero();

            // ---- idempotence: a second run applies nothing and a manager's later change survives it ----
            exec(c, "update match_result set visible_to_players = false, visible_to_players_at = null, visible_to_players_by = null where id = '" + published + "'");
            exec(c, "update match_result set visible_to_players = true where id = '" + unpublished + "'");
            migrate(database, "db/changelog/db.changelog-master.xml");
            c.setAutoCommit(true);
            assertThat(visible(c, published)).as("062 must not run twice").isFalse();
            assertThat(visible(c, unpublished)).isTrue();
            assertThat(count(c, "select count(*) from databasechangelog where filename like '%061-result-visible-to-players.sql'")).isEqualTo(1);
            assertThat(count(c, "select count(*) from databasechangelog where filename like '%062-result-visible-to-players-backfill.sql'")).isEqualTo(1);
            // the checksums are stored (Liquibase validates them on every start; a later edit of either file would fail it)
            assertThat(count(c, "select count(*) from databasechangelog where filename like '%06_-result-visible-to-players%' and md5sum is not null")).isEqualTo(2);
        }
    }

    private static UUID result(Connection c, UUID club, UUID season, UUID team, String status, String publishedAt, String publishedBy)
            throws SQLException {
        UUID match = insert(c, "insert into match (id, club_id, home_team_id, away_team_name, season_id, match_date) values (?, '" + club + "', '" + team + "', 'Occasionals', '" + season + "', now())");
        return insert(c, "insert into match_result (id, club_id, match_id, status, outcome_type, published_at, published_by) values (?, '" + club + "', '" + match + "', '" + status + "', 'TIE', " + publishedAt + ", " + publishedBy + ")");
    }

    private static boolean visible(Connection c, UUID resultId) throws SQLException {
        return count(c, "select count(*) from match_result where visible_to_players and id = '" + resultId + "'") == 1;
    }

    private static void exec(Connection c, String sql) throws SQLException {
        try (PreparedStatement s = c.prepareStatement(sql)) {
            s.executeUpdate();
        }
    }

    private static int count(Connection c, String sql) throws SQLException {
        try (PreparedStatement s = c.prepareStatement(sql); ResultSet r = s.executeQuery()) {
            r.next();
            return r.getInt(1);
        }
    }

    private static String single(Connection c, String sql) throws SQLException {
        try (PreparedStatement s = c.prepareStatement(sql); ResultSet r = s.executeQuery()) {
            r.next();
            return r.getString(1);
        }
    }

    private static UUID insert(Connection c, String sql) throws SQLException {
        UUID id = UUID.randomUUID();
        try (PreparedStatement s = c.prepareStatement(sql)) {
            s.setObject(1, id);
            s.executeUpdate();
        }
        return id;
    }
}
