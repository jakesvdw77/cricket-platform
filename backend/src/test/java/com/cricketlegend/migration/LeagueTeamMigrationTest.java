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
 * Proves 036-add-league-team.sql applies cleanly over pre-existing data (docs/specs/070-league-teams.md
 * Test Plan, Integration tier): matches seeded in the old shape (team id XOR name, no league-team
 * ids) survive the rewritten {@code ck_match_home_side}/{@code ck_match_away_side} CHECKs untouched,
 * with the new columns null, and the new CHECKs are live afterwards.
 *
 * <p>Same technique as {@link PersonSubscriptionMigrationBackfillTest}: drive Liquibase directly
 * against a raw Testcontainers Postgres (no Spring context) in two passes, the first through a
 * test-only changelog that stops at 035.
 */
@Testcontainers
class LeagueTeamMigrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    @Test
    void migration036KeepsOldShapeMatchesUntouchedAndEnforcesRewrittenChecks() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            Database database =
                    DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection));

            new Liquibase("db/changelog/changelog-through-035-test-only.xml", new ClassLoaderResourceAccessor(), database)
                    .update(new Contexts(), new LabelExpression());

            UUID club = insert(connection, "insert into club (id, name, slug, status) values (?, 'Riverside CC', 'riverside', 'ACTIVE')");
            UUID season = insert(connection, "insert into season (id, club_id, label, start_date, end_date) values (?, '" + club + "', '2026', '2026-01-01', '2026-12-31')");
            UUID section = insert(connection, "insert into section (id, club_id, name) values (?, '" + club + "', 'Seniors')");
            UUID team = insert(connection, "insert into team (id, club_id, section_id, name) values (?, '" + club + "', '" + section + "', '1st XI')");
            UUID league = insert(connection, "insert into league (id, club_id, name) values (?, '" + club + "', 'Premier')");

            String cols = "(id, club_id, home_team_id, home_team_name, away_team_id, away_team_name, league_id, season_id, match_date) ";
            String tail = ", '" + league + "', '" + season + "', now())";
            UUID ownVsFree = insert(connection, "insert into match " + cols + "values (?, '" + club + "', '" + team + "', null, null, 'Hillside CC'" + tail);
            UUID freeVsOwn = insert(connection, "insert into match " + cols + "values (?, '" + club + "', null, 'Oakwood CC', '" + team + "', null" + tail);
            UUID freeVsFree = insert(connection, "insert into match " + cols + "values (?, '" + club + "', null, 'A CC', null, 'B CC'" + tail);

            new Liquibase("db/changelog/db.changelog-master.xml", new ClassLoaderResourceAccessor(), database)
                    .update(new Contexts(), new LabelExpression());

            // Autocommit so each rejected insert below doesn't poison a shared transaction.
            connection.setAutoCommit(true);

            assertOldShapeRow(connection, ownVsFree, team, null, null, "Hillside CC");
            assertOldShapeRow(connection, freeVsOwn, null, "Oakwood CC", team, null);
            assertOldShapeRow(connection, freeVsFree, null, "A CC", null, "B CC");

            // The rewritten CHECKs are live: a team id together with a name is still rejected,
            // a league-team id without a name is rejected, and a named league-team side is accepted.
            UUID leagueTeam = insert(connection, "insert into league_team (id, league_id, season_id, name) values (?, '" + league + "', '" + season + "', 'Hillside CC')");
            assertThatThrownBy(() -> insert(connection, "insert into match " + cols + "values (?, '" + club + "', '" + team + "', 'X', null, 'Y'" + tail))
                    .isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> insert(connection, "insert into match (id, club_id, home_team_name, home_league_team_id, away_team_name, season_id, match_date) values (?, '" + club + "', null, '" + leagueTeam + "', 'Y', '" + season + "', now())"))
                    .isInstanceOf(SQLException.class);
            insert(connection, "insert into match (id, club_id, home_team_name, home_league_team_id, away_team_name, season_id, match_date) values (?, '" + club + "', 'Hillside CC', '" + leagueTeam + "', 'Y', '" + season + "', now())");
        }
    }

    private void assertOldShapeRow(Connection c, UUID id, UUID homeTeam, String homeName, UUID awayTeam, String awayName)
            throws SQLException {
        try (PreparedStatement s = c.prepareStatement(
                "select home_team_id, home_team_name, away_team_id, away_team_name, home_league_team_id, away_league_team_id "
                        + "from match where id = ?")) {
            s.setObject(1, id);
            try (ResultSet r = s.executeQuery()) {
                assertThat(r.next()).isTrue();
                assertThat(r.getObject(1)).isEqualTo(homeTeam);
                assertThat(r.getString(2)).isEqualTo(homeName);
                assertThat(r.getObject(3)).isEqualTo(awayTeam);
                assertThat(r.getString(4)).isEqualTo(awayName);
                assertThat(r.getObject(5)).isNull();
                assertThat(r.getObject(6)).isNull();
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
