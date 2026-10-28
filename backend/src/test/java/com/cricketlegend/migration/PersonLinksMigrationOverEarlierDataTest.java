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
 * Migrations 053 (person links, link requests, attempt counters, person origin, lower(email) index) and 054 (link request
 * contact number) of docs/specs/119, applied over data that already exists. Same technique as {@link
 * ScorecardMigrationOverEarlierDataTest}: Liquibase driven directly against a raw Testcontainers Postgres in passes
 * through test-only changelogs that stop at 052 and 053.
 */
@Testcontainers
class PersonLinksMigrationOverEarlierDataTest {

    @Container
    PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    private static void migrate(Connection c, Database database, String changelog) throws Exception {
        new Liquibase(changelog, new ClassLoaderResourceAccessor(), database).update(new Contexts(), new LabelExpression());
        c.setAutoCommit(true);
    }

    @Test
    void migrations053And054ApplyOverEarlierDataAndTheirConstraintsHold() throws Exception {
        try (Connection c = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            Database database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));

            // ---- 052 data: people and players that exist before the link tables ----
            migrate(c, database, "db/changelog/changelog-through-052-test-only.xml");
            UUID club = insert(c, "insert into club (id, name, slug, status) values (?, 'Riverside CC', 'riverside', 'ACTIVE')");
            UUID otherClub = insert(c, "insert into club (id, name, slug, status) values (?, 'Hillcrest CC', 'hillcrest', 'ACTIVE')");
            UUID parent = insert(c, "insert into person (id, first_name, last_name, email) values (?, 'Pat', 'Parent', 'pat@example.com')");
            UUID kid = insert(c, "insert into person (id, first_name, last_name) values (?, 'Sam', 'Smith')");
            UUID kidProfile = insert(c, "insert into player_profile (id, person_id, club_id, email) values (?, '" + kid + "', '" + club + "', 'Pat@Example.com')");

            // ---- 053 applies, existing rows are CLUB_CREATED ----
            migrate(c, database, "db/changelog/changelog-through-053-test-only.xml");
            assertThat(str(c, "select origin from person where id = '" + parent + "'")).isEqualTo("CLUB_CREATED");
            assertThat(str(c, "select origin from person where id = '" + kid + "'")).isEqualTo("CLUB_CREATED");
            assertThatThrownBy(() -> exec(c, "update person set origin = 'MADE_UP' where id = '" + kid + "'"))
                    .isInstanceOf(SQLException.class);
            assertThat(count(c, "select count(*) from pg_indexes where indexname = 'ix_player_profile_email_lower'")).isEqualTo(1);
            // the lower(email) index is what the email match uses
            assertThat(count(c, "select count(*) from player_profile where lower(email) = 'pat@example.com'")).isEqualTo(1);

            // partial unique indexes: one ACTIVE main per player and club, one open link per account and player
            UUID mainLink = link(c, parent, kid, club, "ACTIVE", true);
            UUID secondAgent = insert(c, "insert into person (id, first_name, last_name, email) values (?, 'Sec', 'Ond', 'sec@example.com')");
            assertThatThrownBy(() -> link(c, secondAgent, kid, club, "ACTIVE", true)).isInstanceOf(SQLException.class);
            link(c, secondAgent, kid, club, "ACTIVE", false); // a non-main second agent is fine
            link(c, secondAgent, kid, otherClub, "ACTIVE", true); // main at another club is fine
            assertThatThrownBy(() -> link(c, parent, kid, club, "ACTIVE", false)).isInstanceOf(SQLException.class); // open twice
            exec(c, "update person_link set status = 'REVOKED', is_main = false where id = '" + mainLink + "'");
            link(c, parent, kid, club, "ACTIVE", true); // after revoking, a new main is fine

            // check constraints
            assertThatThrownBy(() -> link(c, kid, kid, club, "ACTIVE", false)).isInstanceOf(SQLException.class); // not self
            assertThatThrownBy(() -> exec(c, "insert into person_link (subject_person_id, club_id, status, granted_via) values ('"
                    + kid + "', '" + club + "', 'INVITED', 'AGENT_INVITE')")).isInstanceOf(SQLException.class); // no target
            exec(c, "insert into person_link (invited_email, subject_person_id, club_id, status, granted_via) values ('x@example.com', '"
                    + kid + "', '" + club + "', 'INVITED', 'AGENT_INVITE')"); // an invitation has no account yet
            assertThatThrownBy(() -> exec(c, "insert into person_link (invited_email, subject_person_id, club_id, status, granted_via) values ('y@example.com', '"
                    + kid + "', '" + club + "', 'BOGUS', 'AGENT_INVITE')")).isInstanceOf(SQLException.class);

            // a link request exists before 054 and has no contact number
            UUID request = insert(c, "insert into link_request (id, account_person_id, club_id, typed_first_name, typed_last_name, typed_date_of_birth)"
                    + " values (?, '" + parent + "', '" + club + "', 'Sam', 'Smith', '2012-06-15')");
            assertThat(str(c, "select status from link_request where id = '" + request + "'")).isEqualTo("PENDING");

            // link_attempt: one row per account and kind
            exec(c, "insert into link_attempt (account_person_id, kind, window_started_at) values ('" + parent + "', 'REQUEST', now())");
            assertThatThrownBy(() -> exec(c, "insert into link_attempt (account_person_id, kind, window_started_at) values ('" + parent + "', 'REQUEST', now())"))
                    .isInstanceOf(SQLException.class);
            exec(c, "insert into link_attempt (account_person_id, kind, window_started_at) values ('" + parent + "', 'INVITE', now())");

            // ---- 054 applies over that request: the old row keeps a NULL contact number, new rows may carry one ----
            migrate(c, database, "db/changelog/db.changelog-master.xml");
            assertThat(count(c, "select count(*) from link_request where id = '" + request + "' and contact_number is null")).isEqualTo(1);
            exec(c, "update link_request set contact_number = '082 123 4567' where id = '" + request + "'");
            assertThat(str(c, "select contact_number from link_request where id = '" + request + "'")).isEqualTo("082 123 4567");
            assertThatThrownBy(() -> exec(c, "update link_request set contact_number = '" + "1".repeat(31) + "' where id = '" + request + "'"))
                    .isInstanceOf(SQLException.class);
            // ---- 055 (section on a link request) applied over that same row: it keeps a NULL section, new ones may carry one ----
            assertThat(count(c, "select count(*) from link_request where id = '" + request + "' and section_id is null")).isEqualTo(1);
            UUID section = insert(c, "insert into section (id, club_id, name, active) values (?, '" + club + "', 'Juniors', true)");
            exec(c, "update link_request set section_id = '" + section + "' where id = '" + request + "'");
            assertThat(count(c, "select count(*) from link_request where section_id = '" + section + "'")).isEqualTo(1);
            assertThatThrownBy(() -> exec(c, "update link_request set section_id = '" + UUID.randomUUID() + "' where id = '" + request + "'"))
                    .isInstanceOf(SQLException.class); // must reference a real section
            assertThat(count(c, "select count(*) from player_profile where id = '" + kidProfile + "'")).isEqualTo(1);
        }
    }

    private static UUID link(Connection c, UUID account, UUID subject, UUID club, String status, boolean main) throws SQLException {
        return insert(c, "insert into person_link (id, account_person_id, subject_person_id, club_id, status, is_main, granted_via)"
                + " values (?, '" + account + "', '" + subject + "', '" + club + "', '" + status + "', " + main + ", 'EMAIL_MATCH')");
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
