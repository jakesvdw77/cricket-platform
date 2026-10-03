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
 * Proves 037-add-match-scoring-streaming-urls.sql applies cleanly over pre-existing data
 * (docs/specs/075-match-view-and-edit.md Test Plan, migration tier): matches seeded before 037 keep
 * both new columns NULL, and the columns accept a 1024-character value.
 *
 * <p>Same technique as {@link LeagueTeamMigrationTest}: Liquibase driven directly against a raw
 * Testcontainers Postgres in two passes, the first through a test-only changelog that stops at 036.
 */
@Testcontainers
class MatchLinksMigrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    @Test
    void migration037LeavesExistingMatchesWithNullLinksAndAccepts1024Characters() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            Database database =
                    DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection));

            new Liquibase("db/changelog/changelog-through-036-test-only.xml", new ClassLoaderResourceAccessor(), database)
                    .update(new Contexts(), new LabelExpression());

            UUID club = insert(connection, "insert into club (id, name, slug, status) values (?, 'Riverside CC', 'riverside', 'ACTIVE')");
            UUID season = insert(connection, "insert into season (id, club_id, label, start_date, end_date) values (?, '" + club + "', '2026', '2026-01-01', '2026-12-31')");
            UUID first = insert(connection, "insert into match (id, club_id, home_team_name, away_team_name, season_id, match_date) values (?, '" + club + "', 'A CC', 'B CC', '" + season + "', now())");
            UUID second = insert(connection, "insert into match (id, club_id, home_team_name, away_team_name, season_id, match_date, venue) values (?, '" + club + "', 'C CC', 'D CC', '" + season + "', now(), 'Oval')");

            new Liquibase("db/changelog/db.changelog-master.xml", new ClassLoaderResourceAccessor(), database)
                    .update(new Contexts(), new LabelExpression());

            connection.setAutoCommit(true);

            assertBothNull(connection, first);
            assertBothNull(connection, second);

            String longUrl = "https://example.com/" + "a".repeat(1004);
            assertThat(longUrl).hasSize(1024);
            try (PreparedStatement s = connection.prepareStatement(
                    "update match set scoring_url = ?, streaming_url = ? where id = ?")) {
                s.setString(1, longUrl);
                s.setString(2, longUrl);
                s.setObject(3, first);
                assertThat(s.executeUpdate()).isEqualTo(1);
            }
            try (PreparedStatement s = connection.prepareStatement(
                    "select scoring_url, streaming_url from match where id = ?")) {
                s.setObject(1, first);
                try (ResultSet r = s.executeQuery()) {
                    assertThat(r.next()).isTrue();
                    assertThat(r.getString(1)).isEqualTo(longUrl);
                    assertThat(r.getString(2)).isEqualTo(longUrl);
                }
            }
        }
    }

    private void assertBothNull(Connection c, UUID id) throws SQLException {
        try (PreparedStatement s = c.prepareStatement("select scoring_url, streaming_url from match where id = ?")) {
            s.setObject(1, id);
            try (ResultSet r = s.executeQuery()) {
                assertThat(r.next()).isTrue();
                assertThat(r.getObject(1)).isNull();
                assertThat(r.getObject(2)).isNull();
            }
        }
    }

    /** Runs an insert whose first bind parameter is a fresh random id, and returns that id. */
    private UUID insert(Connection connection, String sql) throws SQLException {
        UUID id = UUID.randomUUID();
        try (PreparedStatement s = connection.prepareStatement(sql)) {
            s.setObject(1, id);
            s.executeUpdate();
        }
        return id;
    }
}
