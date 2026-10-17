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
 * Migration 049 (docs/specs/110-league-age-cutoff-day-and-month.md Test Plan) applied over a database that already holds
 * leagues with the old dated {@code age_cutoff_date}. Same technique as {@link ResultImportMigrationOverEarlierDataTest}:
 * Liquibase driven directly against a raw Testcontainers Postgres, first through a test-only changelog that stops at 048.
 */
@Testcontainers
class LeagueAgeCutoffMigrationOverEarlierDataTest {

    @Container
    PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    private static void migrate(Connection c, Database database, String changelog) throws Exception {
        new Liquibase(changelog, new ClassLoaderResourceAccessor(), database).update(new Contexts(), new LabelExpression());
        c.setAutoCommit(true);
    }

    @Test
    void migration049DropsTheDatedColumnKeepsLeaguesWithNullCutoffAndChecksTheDayAndMonth() throws Exception {
        try (Connection c = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            Database database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));

            // ---- 048 data: a league with the old dated cut-off ----
            migrate(c, database, "db/changelog/changelog-through-048-test-only.xml");
            assertThat(count(c, "select count(*) from information_schema.columns where table_name = 'league' and column_name = 'age_cutoff_date'")).isEqualTo(1);
            UUID club = insert(c, "insert into club (id, name, slug, status) values (?, 'Riverside CC', 'riverside', 'ACTIVE')");
            UUID league = insert(c, "insert into league (id, club_id, name, source, max_playing_xi_size, min_age, max_age, age_cutoff_date, active) "
                    + "values (?, '" + club + "', 'U15s', 'INTERNAL', 11, 12, 15, '2026-09-01', true)");

            // ---- 049 applies ----
            migrate(c, database, "db/changelog/db.changelog-master.xml");

            assertThat(count(c, "select count(*) from information_schema.columns where table_name = 'league' and column_name = 'age_cutoff_date'")).isZero();
            assertThat(count(c, "select count(*) from league where id = '" + league + "' and age_cutoff_month is null and age_cutoff_day is null and min_age = 12")).isEqualTo(1);

            // both or neither, month 1 to 12, a day that exists in the month (29 February allowed)
            exec(c, "update league set age_cutoff_month = 12, age_cutoff_day = 31 where id = '" + league + "'");
            exec(c, "update league set age_cutoff_month = 2, age_cutoff_day = 29 where id = '" + league + "'");
            exec(c, "update league set age_cutoff_month = null, age_cutoff_day = null where id = '" + league + "'");
            for (String bad : new String[] {
                    "age_cutoff_month = 12", "age_cutoff_day = 31", "age_cutoff_month = 13, age_cutoff_day = 1",
                    "age_cutoff_month = 0, age_cutoff_day = 1", "age_cutoff_month = 4, age_cutoff_day = 31",
                    "age_cutoff_month = 2, age_cutoff_day = 30", "age_cutoff_month = 1, age_cutoff_day = 0"}) {
                assertThatThrownBy(() -> exec(c, "update league set " + bad + " where id = '" + league + "'"))
                        .as(bad).isInstanceOf(SQLException.class);
            }
        }
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

    private static UUID insert(Connection c, String sql) throws SQLException {
        UUID id = UUID.randomUUID();
        try (PreparedStatement s = c.prepareStatement(sql)) {
            s.setObject(1, id);
            s.executeUpdate();
        }
        return id;
    }
}
