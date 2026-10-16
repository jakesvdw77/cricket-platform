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
 * Migration 048 (docs/specs/104-match-results-import-adaptors.md Test Plan, backend integration) applied over a database
 * that already holds 047 data. Same technique as {@link ScorecardMigrationOverEarlierDataTest}: Liquibase driven
 * directly against a raw Testcontainers Postgres, first through a test-only changelog that stops at 047.
 */
@Testcontainers
class ResultImportMigrationOverEarlierDataTest {

    @Container
    PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    private static void migrate(Connection c, Database database, String changelog) throws Exception {
        new Liquibase(changelog, new ClassLoaderResourceAccessor(), database).update(new Contexts(), new LabelExpression());
        c.setAutoCommit(true);
    }

    @Test
    void migration048KeepsEarlierRowsWithANullGuessFlagAndEnforcesItsConstraints() throws Exception {
        try (Connection c = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            Database database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));

            // ---- 047 data ----
            migrate(c, database, "db/changelog/changelog-through-047-test-only.xml");
            assertThat(count(c, "select count(*) from information_schema.columns where table_name = 'result_player' and column_name = 'import_match'")).isZero();
            assertThat(count(c, "select count(*) from information_schema.tables where table_name = 'result_name_alias'")).isZero();
            UUID club = insert(c, "insert into club (id, name, slug, status) values (?, 'Riverside CC', 'riverside', 'ACTIVE')");
            UUID otherClub = insert(c, "insert into club (id, name, slug, status) values (?, 'Hilltop CC', 'hilltop', 'ACTIVE')");
            UUID season = insert(c, "insert into season (id, club_id, label, start_date, end_date) values (?, '" + club + "', '2026', '2026-01-01', '2026-12-31')");
            UUID section = insert(c, "insert into section (id, club_id, name) values (?, '" + club + "', 'Seniors')");
            UUID team = insert(c, "insert into team (id, club_id, section_id, name) values (?, '" + club + "', '" + section + "', '1st XI')");
            UUID match = insert(c, "insert into match (id, club_id, home_team_id, away_team_name, season_id, match_date) values (?, '" + club + "', '" + team + "', 'Occasionals', '" + season + "', now())");
            UUID result = insert(c, "insert into match_result (id, club_id, match_id, status) values (?, '" + club + "', '" + match + "', 'DRAFT')");
            UUID person = insert(c, "insert into person (id, first_name, last_name, email) values (?, 'Ann', 'Player', 'ann@example.com')");
            UUID profile = insert(c, "insert into player_profile (id, person_id, club_id) values (?, '" + person + "', '" + club + "')");
            UUID registered = insert(c, "insert into result_player (id, match_result_id, side, player_profile_id) values (?, '" + result + "', 'HOME', '" + profile + "')");
            UUID guest = insert(c, "insert into result_player (id, match_result_id, side, display_name) values (?, '" + result + "', 'HOME', 'Sam Guest')");
            UUID opposition = insert(c, "insert into result_player (id, match_result_id, side, display_name, opposition) values (?, '" + result + "', 'AWAY', 'Olly Opp', true)");

            // ---- 048 applies ----
            migrate(c, database, "db/changelog/db.changelog-master.xml");

            assertThat(count(c, "select count(*) from result_player")).isEqualTo(3);
            assertThat(count(c, "select count(*) from result_player where import_match is not null")).isZero();

            // the flag: only the two known levels, only on one of our registered players
            assertThatThrownBy(() -> exec(c, "update result_player set import_match = 'GUESS' where id = '" + registered + "'"))
                    .isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> exec(c, "update result_player set import_match = 'NORMALISED' where id = '" + guest + "'"))
                    .isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> exec(c, "update result_player set import_match = 'NORMALISED' where id = '" + opposition + "'"))
                    .isInstanceOf(SQLException.class);
            exec(c, "update result_player set import_match = 'NORMALISED' where id = '" + registered + "'");
            exec(c, "update result_player set import_match = 'AI_SUGGESTED' where id = '" + registered + "'");
            exec(c, "update result_player set import_match = null where id = '" + registered + "'");

            // the alias table: kind and target pair up
            String player = "insert into result_name_alias (club_id, kind, alias_normalised, alias_original, target_player_profile_id) values ('%s', 'PLAYER', '%s', '%s', '" + profile + "')";
            assertThatThrownBy(() -> exec(c, "insert into result_name_alias (club_id, kind, alias_normalised, alias_original, target_player_profile_id) values ('" + club + "', 'COACH', 'x', 'X', '" + profile + "')"))
                    .isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> exec(c, "insert into result_name_alias (club_id, kind, alias_normalised, alias_original, target_team_id) values ('" + club + "', 'PLAYER', 'x', 'X', '" + team + "')"))
                    .isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> exec(c, "insert into result_name_alias (club_id, kind, alias_normalised, alias_original) values ('" + club + "', 'PLAYER', 'x', 'X')"))
                    .isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> exec(c, "insert into result_name_alias (club_id, kind, alias_normalised, alias_original, target_player_profile_id, target_team_id) values ('" + club + "', 'TEAM', 'x', 'X', '" + profile + "', '" + team + "')"))
                    .isInstanceOf(SQLException.class);
            exec(c, "insert into result_name_alias (club_id, kind, alias_normalised, alias_original, target_team_id) values ('" + club + "', 'TEAM', 'ann player', 'Ann Player', '" + team + "')");

            // the partial unique index: one ACTIVE alias per club, kind and spelling
            exec(c, player.formatted(club, "a player", "A Player"));
            assertThatThrownBy(() -> exec(c, player.formatted(club, "a player", "a  PLAYER"))).isInstanceOf(SQLException.class);
            exec(c, player.formatted(otherClub, "a player", "A Player"));
            exec(c, "update result_name_alias set active = false where club_id = '" + club + "' and kind = 'PLAYER' and alias_normalised = 'a player'");
            exec(c, player.formatted(club, "a player", "A Player"));
            assertThat(count(c, "select count(*) from result_name_alias where club_id = '" + club + "' and kind = 'PLAYER' and alias_normalised = 'a player'")).isEqualTo(2);
            assertThat(count(c, "select count(*) from result_name_alias where club_id = '" + club + "' and kind = 'PLAYER' and alias_normalised = 'a player' and active")).isEqualTo(1);
            // the same spelling for a different kind is not a clash
            assertThat(count(c, "select count(*) from result_name_alias where alias_normalised = 'ann player'")).isEqualTo(1);

            // an alias dies with its target
            exec(c, "delete from result_player where match_result_id = '" + result + "'");
            exec(c, "delete from player_profile where id = '" + profile + "'");
            assertThat(count(c, "select count(*) from result_name_alias where target_player_profile_id is not null")).isZero();
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
