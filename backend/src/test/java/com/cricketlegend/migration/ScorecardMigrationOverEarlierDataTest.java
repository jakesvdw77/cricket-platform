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
 * Migrations 044 to 047 (docs/specs/101-match-results-our-side-scorecard.md Test Plan, migration tier) applied over
 * data that already exists: 044 over a database holding a 043 result and innings, then 045, 046 and 047 over a
 * database holding 044 scorecard rows. Same technique as {@link TeamSelectionMigrationTest}: Liquibase driven directly
 * against a raw Testcontainers Postgres in passes, each stopping one stage earlier through a test-only changelog.
 */
@Testcontainers
class ScorecardMigrationOverEarlierDataTest {

    // an instance field: each test gets its own database, as the first must start before 044 exists
    @Container
    PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    private static void migrate(Connection c, Database database, String changelog) throws Exception {
        new Liquibase(changelog, new ClassLoaderResourceAccessor(), database).update(new Contexts(), new LabelExpression());
        // each statement of the assertions below commits (or fails) on its own
        c.setAutoCommit(true);
    }

    @Test
    void migrations044To047ApplyOverEarlierDataAndKeepItIntact() throws Exception {
        try (Connection c = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            Database database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));

            // ---- 043 data ----
            migrate(c, database, "db/changelog/changelog-through-043-test-only.xml");
            c.setAutoCommit(true);
            UUID club = insert(c, "insert into club (id, name, slug, status) values (?, 'Riverside CC', 'riverside', 'ACTIVE')");
            UUID season = insert(c, "insert into season (id, club_id, label, start_date, end_date) values (?, '" + club + "', '2026', '2026-01-01', '2026-12-31')");
            UUID section = insert(c, "insert into section (id, club_id, name) values (?, '" + club + "', 'Seniors')");
            UUID team = insert(c, "insert into team (id, club_id, section_id, name) values (?, '" + club + "', '" + section + "', '1st XI')");
            UUID match = insert(c, "insert into match (id, club_id, home_team_id, away_team_name, season_id, match_date) values (?, '" + club + "', '" + team + "', 'Occasionals', '" + season + "', now())");
            UUID result = insert(c, "insert into match_result (id, club_id, match_id, status) values (?, '" + club + "', '" + match + "', 'DRAFT')");
            UUID first = insert(c, "insert into match_innings (id, match_result_id, sequence, kind, batting_side, runs, wickets, balls) values (?, '" + result + "', 1, 'REGULAR', 'HOME', 200, 8, 120)");
            UUID second = insert(c, "insert into match_innings (id, match_result_id, sequence, kind, batting_side, runs, wickets, balls) values (?, '" + result + "', 2, 'REGULAR', 'AWAY', 150, 10, 120)");
            // 043 has a plain unique sequence: swapping two sequences inside one transaction fails
            c.setAutoCommit(false);
            assertThatThrownBy(() -> swapSequences(c, first, second)).isInstanceOf(SQLException.class);
            c.rollback();
            c.setAutoCommit(true);

            // ---- 044 applies; its data is seeded ----
            migrate(c, database, "db/changelog/changelog-through-044-test-only.xml");
            assertThat(count(c, "select count(*) from match_innings where match_result_id = '" + result + "'")).isEqualTo(2);
            UUID person = insert(c, "insert into person (id, first_name, last_name, email) values (?, 'Ann', 'Player', 'ann@example.com')");
            UUID profile = insert(c, "insert into player_profile (id, person_id, club_id) values (?, '" + person + "', '" + club + "')");
            UUID ann = insert(c, "insert into result_player (id, match_result_id, side, player_profile_id) values (?, '" + result + "', 'HOME', '" + profile + "')");
            UUID guest = insert(c, "insert into result_player (id, match_result_id, side, display_name) values (?, '" + result + "', 'AWAY', 'Smith')");
            insert(c, "insert into batting_entry (id, match_innings_id, result_player_id, position, how_out, runs) values (?, '" + first + "', '" + ann + "', 1, 'BOWLED', 50)");
            insert(c, "insert into bowling_entry (id, match_innings_id, result_player_id, balls, runs, wickets) values (?, '" + first + "', '" + guest + "', 24, 30, 2)");
            insert(c, "insert into fielding_entry (id, match_innings_id, result_player_id, catches) values (?, '" + second + "', '" + ann + "', 2)");
            UUID award = insert(c, "insert into match_award (id, match_result_id, award_type, side, result_player_id, display_name) values (?, '" + result + "', 'PLAYER_OF_MATCH', 'AWAY', '" + guest + "', 'Smith')");
            // 044: the innings figures are still required, how_out is required, an award row dies with its player
            assertThatThrownBy(() -> exec(c, "insert into match_innings (match_result_id, sequence, kind, batting_side) values ('" + result + "', 3, 'SUPER_OVER', 'HOME')"))
                    .isInstanceOf(SQLException.class);
            // sequences swap in one transaction now that the constraint is deferred
            c.setAutoCommit(false);
            swapSequences(c, first, second);
            c.commit();
            c.setAutoCommit(true);

            // ---- 045, 046, 047 apply over the 044 rows ----
            migrate(c, database, "db/changelog/db.changelog-master.xml");

            assertThat(str(c, "select cast(opposition as text) from result_player where id = '" + ann + "'")).isEqualTo("false");
            assertThat(str(c, "select wickets_source from bowling_entry")).isEqualTo("MANUAL");
            assertThat(str(c, "select credits_source from fielding_entry")).isEqualTo("MANUAL");
            assertThat(str(c, "select cast(dots as text) from bowling_entry")).isNull();
            assertThat(str(c, "select cast(bowler_result_player_id as text) from batting_entry")).isNull();
            assertThat(count(c, "select count(*) from batting_entry")).isEqualTo(1);

            // 045: an opposition row is a name only; dots never above balls; closed enums
            assertThatThrownBy(() -> exec(c, "insert into result_player (match_result_id, side, display_name, opposition, planned_batting_order) values ('" + result + "', 'AWAY', 'Jones', true, 3)"))
                    .isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> exec(c, "insert into result_player (match_result_id, side, player_profile_id, opposition) values ('" + result + "', 'AWAY', '" + profile + "', true)"))
                    .isInstanceOf(SQLException.class);
            exec(c, "insert into result_player (match_result_id, side, display_name, opposition) values ('" + result + "', 'AWAY', 'Jones', true)");
            assertThatThrownBy(() -> exec(c, "update bowling_entry set dots = 25")).isInstanceOf(SQLException.class);
            exec(c, "update bowling_entry set dots = 24");
            assertThatThrownBy(() -> exec(c, "update bowling_entry set wickets_source = 'GUESS'")).isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> exec(c, "update fielding_entry set credits_source = 'GUESS'")).isInstanceOf(SQLException.class);

            // 046: innings figures may be absent, ranges still hold
            exec(c, "insert into match_innings (match_result_id, sequence, kind, batting_side) values ('" + result + "', 3, 'SUPER_OVER', 'HOME')");
            assertThatThrownBy(() -> exec(c, "update match_innings set wickets = 11 where sequence = 3")).isInstanceOf(SQLException.class);

            // 047: how_out may be absent, a wrong value may not
            exec(c, "insert into batting_entry (match_innings_id, result_player_id, how_out, runs) values ('" + first + "', '" + guest + "', null, 4)");
            assertThatThrownBy(() -> exec(c, "update batting_entry set how_out = 'ELSEWHERE' where how_out is null")).isInstanceOf(SQLException.class);

            // 045: the dismissal references and the award now survive the player's removal
            exec(c, "update batting_entry set bowler_result_player_id = '" + guest + "', fielder_result_player_id = '" + guest + "' where how_out = 'BOWLED'");
            exec(c, "delete from result_player where id = '" + guest + "'");
            assertThat(str(c, "select cast(bowler_result_player_id as text) from batting_entry where how_out = 'BOWLED'")).isNull();
            assertThat(str(c, "select cast(fielder_result_player_id as text) from batting_entry where how_out = 'BOWLED'")).isNull();
            assertThat(count(c, "select count(*) from bowling_entry")).isZero();
            assertThat(str(c, "select display_name from match_award where id = '" + award + "'")).isEqualTo("Smith");
            assertThat(str(c, "select cast(result_player_id as text) from match_award where id = '" + award + "'")).isNull();
        }
    }

    @Test
    void thePerSideUniqueIndexesAllowTheSameGuestOnEachSideAndRefuseItTwiceOnOne() throws Exception {
        try (Connection c = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            Database database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));
            migrate(c, database, "db/changelog/db.changelog-master.xml");
            c.setAutoCommit(true);
            UUID club = insert(c, "insert into club (id, name, slug, status) values (?, 'Hillside CC', 'hillside', 'ACTIVE')");
            UUID season = insert(c, "insert into season (id, club_id, label, start_date, end_date) values (?, '" + club + "', '2026', '2026-01-01', '2026-12-31')");
            UUID section = insert(c, "insert into section (id, club_id, name) values (?, '" + club + "', 'Seniors')");
            UUID team = insert(c, "insert into team (id, club_id, section_id, name) values (?, '" + club + "', '" + section + "', '1st XI')");
            UUID team2 = insert(c, "insert into team (id, club_id, section_id, name) values (?, '" + club + "', '" + section + "', '2nd XI')");
            UUID match = insert(c, "insert into match (id, club_id, home_team_id, away_team_id, season_id, match_date) values (?, '" + club + "', '" + team + "', '" + team2 + "', '" + season + "', now())");
            UUID result = insert(c, "insert into match_result (id, club_id, match_id, status) values (?, '" + club + "', '" + match + "', 'DRAFT')");
            UUID person = insert(c, "insert into person (id, first_name, last_name, email) values (?, 'Bob', 'Player', 'bob@example.com')");
            UUID profile = insert(c, "insert into player_profile (id, person_id, club_id) values (?, '" + person + "', '" + club + "')");
            String guest = "insert into result_player (match_result_id, side, display_name) values ('" + result + "', '%s', '%s')";
            String registered = "insert into result_player (match_result_id, side, player_profile_id) values ('" + result + "', '%s', '" + profile + "')";

            exec(c, guest.formatted("HOME", "John Smith"));
            exec(c, guest.formatted("AWAY", "John Smith"));
            assertThatThrownBy(() -> exec(c, guest.formatted("HOME", "JOHN SMITH"))).isInstanceOf(SQLException.class);
            exec(c, registered.formatted("HOME"));
            exec(c, registered.formatted("AWAY"));
            assertThatThrownBy(() -> exec(c, registered.formatted("HOME"))).isInstanceOf(SQLException.class);

            // one official award per result, one team award per side
            String awards = "insert into match_award (match_result_id, award_type, side, display_name) values ('" + result + "', '%s', '%s', 'X')";
            exec(c, awards.formatted("PLAYER_OF_MATCH", "HOME"));
            assertThatThrownBy(() -> exec(c, awards.formatted("PLAYER_OF_MATCH", "AWAY"))).isInstanceOf(SQLException.class);
            exec(c, awards.formatted("TEAM_PLAYER_OF_MATCH", "HOME"));
            exec(c, awards.formatted("TEAM_PLAYER_OF_MATCH", "AWAY"));
            assertThatThrownBy(() -> exec(c, awards.formatted("TEAM_PLAYER_OF_MATCH", "HOME"))).isInstanceOf(SQLException.class);
        }
    }

    private static void swapSequences(Connection c, UUID first, UUID second) throws SQLException {
        exec(c, "update match_innings set sequence = 2 where id = '" + first + "'");
        exec(c, "update match_innings set sequence = 1 where id = '" + second + "'");
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

    private static String str(Connection c, String sql) throws SQLException {
        try (PreparedStatement s = c.prepareStatement(sql); ResultSet r = s.executeQuery()) {
            assertThat(r.next()).as(sql).isTrue();
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
