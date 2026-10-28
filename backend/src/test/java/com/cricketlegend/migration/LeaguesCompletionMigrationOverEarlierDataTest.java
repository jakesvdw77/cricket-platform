package com.cricketlegend.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
 * Proves migrations 056 and 057 (docs/specs/122-league-sharing.md and docs/specs/124-playing-conditions-balls-and-free-hit.md)
 * apply over pre-existing data with the documented defaults: a club profile that existed before 056 has no disabled
 * format ('{}'), a playing-conditions row that existed before 057 has no balls-per-over limit and free hit on, and
 * the balls-per-over check accepts null and 1..20 only.
 *
 * <p>Same technique as {@link MatchLinksMigrationTest}: Liquibase against a raw Testcontainers Postgres in two passes,
 * the first through a test-only changelog that stops at 055.
 */
@Testcontainers
class LeaguesCompletionMigrationOverEarlierDataTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    @Test
    void migrations056And057KeepEarlierRowsOnTheDocumentedDefaults() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            Database database =
                    DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection));

            new Liquibase("db/changelog/changelog-through-055-test-only.xml", new ClassLoaderResourceAccessor(), database)
                    .update(new Contexts(), new LabelExpression());

            UUID club = insert(connection, "insert into club (id, name, slug, status) values (?, 'Riverside CC', 'riverside', 'ACTIVE')");
            execute(connection, "insert into club_profile (club_id) values ('" + club + "')");
            UUID season = insert(connection, "insert into season (id, club_id, label, start_date, end_date) values (?, '" + club + "', '2026', '2026-01-01', '2026-12-31')");
            UUID league = insert(connection, "insert into league (id, club_id, name) values (?, '" + club + "', 'Division 1')");
            UUID conditions = insert(connection, "insert into league_playing_conditions (id, league_id, season_id, max_overs_per_innings) values (?, '" + league + "', '" + season + "', 40)");

            new Liquibase("db/changelog/db.changelog-master.xml", new ClassLoaderResourceAccessor(), database)
                    .update(new Contexts(), new LabelExpression());

            connection.setAutoCommit(true);

            assertThat(single(connection, "select share_disabled_formats from club_profile where club_id = '" + club + "'"))
                    .isEqualTo("{}");
            assertThat(single(connection, "select max_balls_per_over from league_playing_conditions where id = '" + conditions + "'"))
                    .isNull();
            assertThat(single(connection, "select free_hit_on_no_ball::text from league_playing_conditions where id = '" + conditions + "'"))
                    .isEqualTo("true");

            execute(connection, "update league_playing_conditions set max_balls_per_over = 1 where id = '" + conditions + "'");
            execute(connection, "update league_playing_conditions set max_balls_per_over = 20 where id = '" + conditions + "'");
            execute(connection, "update league_playing_conditions set max_balls_per_over = null where id = '" + conditions + "'");
            assertThatThrownBy(() -> execute(connection,
                            "update league_playing_conditions set max_balls_per_over = 0 where id = '" + conditions + "'"))
                    .isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> execute(connection,
                            "update league_playing_conditions set max_balls_per_over = 21 where id = '" + conditions + "'"))
                    .isInstanceOf(SQLException.class);
        }
    }

    private static UUID insert(Connection connection, String sql) throws SQLException {
        UUID id = UUID.randomUUID();
        try (PreparedStatement s = connection.prepareStatement(sql)) {
            s.setObject(1, id);
            s.executeUpdate();
        }
        return id;
    }

    private static void execute(Connection connection, String sql) throws SQLException {
        try (PreparedStatement s = connection.prepareStatement(sql)) {
            s.executeUpdate();
        }
    }

    private static String single(Connection connection, String sql) throws SQLException {
        try (PreparedStatement s = connection.prepareStatement(sql); ResultSet r = s.executeQuery()) {
            assertThat(r.next()).isTrue();
            return r.getString(1);
        }
    }
}
