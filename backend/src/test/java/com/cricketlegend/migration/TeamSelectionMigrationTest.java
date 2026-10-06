package com.cricketlegend.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
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
 * Proves 038-team-selection.sql applies cleanly over pre-existing data (docs/specs/076-team-selection.md
 * Test Plan, migration tier): {@code batting_order} accepts NULL, two NULLs on one side are allowed,
 * two equal non-NULL positions still violate the unique constraint, every existing 12th man gains
 * exactly one row with a NULL order and role BATSMAN, and a 12th man who is already a row is not
 * duplicated.
 *
 * <p>Same technique as {@link MatchLinksMigrationTest}: Liquibase driven directly against a raw
 * Testcontainers Postgres in two passes, the first through a test-only changelog that stops at 037.
 */
@Testcontainers
class TeamSelectionMigrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    @Test
    void migration038AllowsNullBattingOrdersAndBackfillsEveryTwelfthManExactlyOnce() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            Database database =
                    DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection));

            new Liquibase("db/changelog/changelog-through-037-test-only.xml", new ClassLoaderResourceAccessor(), database)
                    .update(new Contexts(), new LabelExpression());
            // Autocommit so the rejected insert below doesn't poison a shared transaction.
            connection.setAutoCommit(true);

            UUID club = insert(connection, "insert into club (id, name, slug, status) values (?, 'Riverside CC', 'riverside', 'ACTIVE')");
            UUID season = insert(connection, "insert into season (id, club_id, label, start_date, end_date) values (?, '" + club + "', '2026', '2026-01-01', '2026-12-31')");
            UUID section = insert(connection, "insert into section (id, club_id, name) values (?, '" + club + "', 'Seniors')");
            UUID team = insert(connection, "insert into team (id, club_id, section_id, name) values (?, '" + club + "', '" + section + "', '1st XI')");
            UUID opposition = insert(connection, "insert into team (id, club_id, section_id, name) values (?, '" + club + "', '" + section + "', '2nd XI')");
            UUID batter = player(connection, club, "Ann");
            UUID alreadyARow = player(connection, club, "Bob");
            UUID bareTwelfth = player(connection, club, "Tim");
            UUID match = insert(connection, "insert into match (id, club_id, home_team_id, away_team_name, season_id, match_date) values (?, '" + club + "', '" + team + "', 'Occasionals', '" + season + "', now())");
            String sideColumns = "insert into match_side (id, match_id, team_id, twelfth_man_player_id) values (?, '" + match + "', '";
            // side one: a 12th man who exists only as the bare id, plus one positioned player
            UUID sideWithBareTwelfth = insert(connection, sideColumns + team + "', '" + bareTwelfth + "')");
            row(connection, sideWithBareTwelfth, batter, 1);
            // side two: a 12th man who is already a selection row (the old Add player control had made him one)
            UUID match2 = insert(connection, "insert into match (id, club_id, home_team_id, away_team_name, season_id, match_date) values (?, '" + club + "', '" + opposition + "', 'Occasionals', '" + season + "', now())");
            UUID sideWithRowTwelfth = insert(connection,
                    "insert into match_side (id, match_id, team_id, twelfth_man_player_id) values (?, '" + match2 + "', '" + opposition + "', '" + alreadyARow + "')");
            row(connection, sideWithRowTwelfth, alreadyARow, 7);
            // side three: no 12th man at all
            UUID match3 = insert(connection, "insert into match (id, club_id, home_team_id, away_team_name, season_id, match_date) values (?, '" + club + "', '" + team + "', 'Occasionals', '" + season + "', now() + interval '1 day')");
            UUID sideWithoutTwelfth = insert(connection,
                    "insert into match_side (id, match_id, team_id) values (?, '" + match3 + "', '" + team + "')");
            row(connection, sideWithoutTwelfth, batter, 1);

            // 037 still has batting_order NOT NULL
            assertThatThrownBy(() -> row(connection, sideWithoutTwelfth, bareTwelfth, null)).isInstanceOf(SQLException.class);

            new Liquibase("db/changelog/db.changelog-master.xml", new ClassLoaderResourceAccessor(), database)
                    .update(new Contexts(), new LabelExpression());

            // Autocommit so each rejected insert below doesn't poison a shared transaction.
            connection.setAutoCommit(true);

            assertThat(orders(connection, sideWithBareTwelfth, bareTwelfth)).containsExactly((Integer) null);
            assertThat(roleOf(connection, sideWithBareTwelfth, bareTwelfth)).isEqualTo("BATSMAN");
            assertThat(orders(connection, sideWithBareTwelfth, batter)).containsExactly(1);
            assertThat(orders(connection, sideWithRowTwelfth, alreadyARow)).containsExactly(7);
            assertThat(count(connection, sideWithRowTwelfth)).isEqualTo(1);
            assertThat(count(connection, sideWithoutTwelfth)).isEqualTo(1);
            assertThat(count(connection, sideWithBareTwelfth)).isEqualTo(2);

            // batting_order now accepts NULL, any number of times on one side ...
            UUID waitingOne = player(connection, club, "Cal");
            UUID waitingTwo = player(connection, club, "Dan");
            row(connection, sideWithoutTwelfth, waitingOne, null);
            row(connection, sideWithoutTwelfth, waitingTwo, null);
            assertThat(count(connection, sideWithoutTwelfth)).isEqualTo(3);

            // ... while two players can still never share a position
            UUID rival = player(connection, club, "Eve");
            assertThatThrownBy(() -> row(connection, sideWithoutTwelfth, rival, 1)).isInstanceOf(SQLException.class);
            row(connection, sideWithoutTwelfth, rival, 2);
        }
    }

    private UUID player(Connection c, UUID club, String firstName) throws SQLException {
        UUID person = insert(c, "insert into person (id, first_name, last_name, email) values (?, '" + firstName
                + "', 'Player', '" + firstName.toLowerCase() + "@example.com')");
        return insert(c, "insert into player_profile (id, person_id, club_id) values (?, '" + person + "', '" + club + "')");
    }

    private void row(Connection c, UUID side, UUID player, Integer battingOrder) throws SQLException {
        try (PreparedStatement s = c.prepareStatement(
                "insert into match_side_player (match_side_id, player_profile_id, batting_order, role) values (?, ?, ?, 'BOWLER')")) {
            s.setObject(1, side);
            s.setObject(2, player);
            s.setObject(3, battingOrder);
            s.executeUpdate();
        }
    }

    private List<Integer> orders(Connection c, UUID side, UUID player) throws SQLException {
        List<Integer> result = new ArrayList<>();
        try (PreparedStatement s = c.prepareStatement(
                "select batting_order from match_side_player where match_side_id = ? and player_profile_id = ?")) {
            s.setObject(1, side);
            s.setObject(2, player);
            try (ResultSet r = s.executeQuery()) {
                while (r.next()) {
                    result.add((Integer) r.getObject(1));
                }
            }
        }
        return result;
    }

    private String roleOf(Connection c, UUID side, UUID player) throws SQLException {
        try (PreparedStatement s = c.prepareStatement(
                "select role from match_side_player where match_side_id = ? and player_profile_id = ?")) {
            s.setObject(1, side);
            s.setObject(2, player);
            try (ResultSet r = s.executeQuery()) {
                assertThat(r.next()).isTrue();
                return r.getString(1);
            }
        }
    }

    private int count(Connection c, UUID side) throws SQLException {
        try (PreparedStatement s = c.prepareStatement("select count(*) from match_side_player where match_side_id = ?")) {
            s.setObject(1, side);
            try (ResultSet r = s.executeQuery()) {
                r.next();
                return r.getInt(1);
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
