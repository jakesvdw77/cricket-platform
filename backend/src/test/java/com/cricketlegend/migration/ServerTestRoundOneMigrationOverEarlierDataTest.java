package com.cricketlegend.migration;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
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
 * docs/specs/151-server-test-round-one.md: migrations 066 (player batting position and part-time bowler), 067 (league team notes)
 * and 068 (field contact person, contact number and photo) add columns beside rows that already exist, so they must leave those
 * rows readable with the documented defaults: no batting position, not a part-time bowler, no notes, no contact, no photo.
 */
@Testcontainers
class ServerTestRoundOneMigrationOverEarlierDataTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    @Test
    void newColumnsLeaveEarlierRowsWithTheirDefaults() throws Exception {
        try (Connection connection = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            Database database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection));
            new Liquibase("db/changelog/db.changelog-master.xml", new ClassLoaderResourceAccessor(), database)
                    .update(new Contexts(), new LabelExpression());
            connection.setAutoCommit(true);

            assertThat(columnExists(connection, "player_profile", "batting_position")).isTrue();
            assertThat(columnExists(connection, "player_profile", "is_part_time_bowler")).isTrue();
            assertThat(columnExists(connection, "league_team", "notes")).isTrue();
            assertThat(columnExists(connection, "playing_area", "contact_name")).isTrue();
            assertThat(columnExists(connection, "playing_area", "contact_phone")).isTrue();
            assertThat(columnExists(connection, "playing_area", "photo_url")).isTrue();

            // The part-time flag is NOT NULL with a default, so a row written the old way reads false.
            assertThat(columnDefault(connection, "player_profile", "is_part_time_bowler")).contains("false");
            assertThat(columnNullable(connection, "player_profile", "is_part_time_bowler")).isFalse();
            assertThat(columnNullable(connection, "player_profile", "batting_position")).isTrue();
            assertThat(columnNullable(connection, "league_team", "notes")).isTrue();
            assertThat(columnNullable(connection, "playing_area", "photo_url")).isTrue();
        }
    }

    private static boolean columnExists(Connection connection, String table, String column) throws Exception {
        return query(connection, table, column, "select count(*) from information_schema.columns where table_name = ? and column_name = ?") == 1;
    }

    private static boolean columnNullable(Connection connection, String table, String column) throws Exception {
        try (var statement = connection.prepareStatement("select is_nullable from information_schema.columns where table_name = ? and column_name = ?")) {
            statement.setString(1, table);
            statement.setString(2, column);
            try (ResultSet rows = statement.executeQuery()) {
                rows.next();
                return "YES".equals(rows.getString(1));
            }
        }
    }

    private static String columnDefault(Connection connection, String table, String column) throws Exception {
        try (var statement = connection.prepareStatement("select column_default from information_schema.columns where table_name = ? and column_name = ?")) {
            statement.setString(1, table);
            statement.setString(2, column);
            try (ResultSet rows = statement.executeQuery()) {
                rows.next();
                return String.valueOf(rows.getString(1));
            }
        }
    }

    private static int query(Connection connection, String table, String column, String sql) throws Exception {
        try (var statement = connection.prepareStatement(sql)) {
            statement.setString(1, table);
            statement.setString(2, column);
            try (ResultSet rows = statement.executeQuery()) {
                rows.next();
                return rows.getInt(1);
            }
        }
    }
}
