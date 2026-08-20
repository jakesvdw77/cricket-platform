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
 * Proves 009-subscription-responsible-person.sql's backfill (dedupe-by-email into {@code person},
 * exactly-one-row-per-distinct-email, {@code responsible_person_id} NOT NULL, the four legacy
 * {@code responsible_contact_*} columns dropped) actually does what
 * docs/specs/014-subscription-responsible-contact.md/docs/plans/014-subscription-responsible-contact.md's
 * Flag 11 describes — against pre-008 data seeded via raw JDBC, not data created through JPA.
 *
 * <p><strong>Deliberately not shaped like this repo's other Testcontainers tests.</strong> Every
 * other integration test extends {@link com.cricketlegend.AbstractIntegrationTest} and boots a
 * real {@code @SpringBootTest} context, which means Liquibase (wired through Spring Boot's
 * autoconfigured {@code SpringLiquibase} bean, an {@code InitializingBean} that runs during
 * context refresh, before any test code can run) has already applied every changeset — including
 * 008/009 — by the time the test body executes. There's no supported hook to pause that process
 * midway. Proving 009's backfill needs data seeded <em>before</em> 008/009 run, which this test
 * gets by driving Liquibase's own Java API directly against a raw Testcontainers Postgres — no
 * Spring context at all. Lives in its own {@code com.cricketlegend.migration} package (not
 * {@code com.cricketlegend.repository}/{@code service}) to flag that it's a different style of
 * test than the rest of this suite, per the plan's own instruction to flag this explicitly.
 *
 * <p>Runs the real production {@code db.changelog-master.xml} up to and including
 * 007-add-subscription-responsible-contact.sql via a test-only fixture changelog
 * ({@code changelog-through-007-test-only.xml}, whose {@code <include>} file paths are copied
 * verbatim from the real master changelog so Liquibase's DATABASECHANGELOG bookkeeping — keyed by
 * filename — lines up), seeds raw {@code responsible_contact_*} rows via JDBC, then re-points
 * Liquibase at the real {@code db.changelog-master.xml} for a second pass: 001-007 are recognized
 * as already applied and skipped, so only 008/009 actually execute.
 */
@Testcontainers
class PersonSubscriptionMigrationBackfillTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    @Test
    void backfillCollapsesSharedEmailIntoOnePersonRowDropsLegacyColumnsAndEnforcesNotNull() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            Database database =
                    DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection));

            // Pass 1: apply 001 through 007 only — the schema as it existed on the eve of this
            // spec, with the discarded draft's responsible_contact_* columns already present.
            Liquibase throughSeven = new Liquibase(
                    "db/changelog/changelog-through-007-test-only.xml", new ClassLoaderResourceAccessor(), database);
            throughSeven.update(new Contexts(), new LabelExpression());

            UUID clubA = seedClub(connection, "Riverside CC", "riverside-cc");
            UUID clubB = seedClub(connection, "Hillside CC", "hillside-cc");
            UUID clubC = seedClub(connection, "Oakwood CC", "oakwood-cc");
            UUID product = seedProduct(connection, "CLUB_STANDARD");

            // Two subscriptions sharing the same email, differing only by case — exactly the
            // scenario 009's INSERT...GROUP BY lower(email) must collapse into one Person, not
            // two. Deliberately not seeding any row with a NULL responsible_contact_email — out of
            // scope per the spec's Rollout Notes/the plan (handled operationally, not by this
            // migration's SQL).
            UUID subscriptionA = seedSubscription(
                    connection, clubA, product, "Jaco", "van der Walt", "Jaco@Example.com", "+27821111111");
            UUID subscriptionB = seedSubscription(
                    connection, clubB, product, "Jacob", "Vanderwalt", "jaco@example.com", "+27822222222");
            // A third, distinct email — proves the backfill doesn't over-collapse unrelated rows
            // into the same Person.
            UUID subscriptionC = seedSubscription(
                    connection, clubC, product, "Priya", "Naidoo", "priya@example.com", "+27823333333");

            // Pass 2: re-point Liquibase at the real production master changelog — 001-007 are
            // already recorded as applied (same file paths), so only 008/009 actually run.
            Liquibase full = new Liquibase(
                    "db/changelog/db.changelog-master.xml", new ClassLoaderResourceAccessor(), database);
            full.update(new Contexts(), new LabelExpression());

            assertExactlyOnePersonRowForTheSharedEmail(connection);
            assertBothSharedEmailSubscriptionsPointAtTheSamePerson(connection, subscriptionA, subscriptionB);
            assertTheDistinctEmailSubscriptionPointsAtADifferentPerson(connection, subscriptionA, subscriptionC);
            assertLegacyContactColumnsAreGone(connection);
            assertResponsiblePersonIdIsNotNullEnforced(connection, product);
        }
    }

    private void assertExactlyOnePersonRowForTheSharedEmail(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "select count(*) from person where lower(email) = ?")) {
            statement.setString(1, "jaco@example.com");
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                assertThat(resultSet.getInt(1)).isEqualTo(1);
            }
        }
    }

    private void assertBothSharedEmailSubscriptionsPointAtTheSamePerson(
            Connection connection, UUID subscriptionA, UUID subscriptionB) throws SQLException {
        UUID personIdA = responsiblePersonId(connection, subscriptionA);
        UUID personIdB = responsiblePersonId(connection, subscriptionB);

        assertThat(personIdA).isNotNull().isEqualTo(personIdB);
    }

    private void assertTheDistinctEmailSubscriptionPointsAtADifferentPerson(
            Connection connection, UUID subscriptionA, UUID subscriptionC) throws SQLException {
        UUID personIdA = responsiblePersonId(connection, subscriptionA);
        UUID personIdC = responsiblePersonId(connection, subscriptionC);

        assertThat(personIdC).isNotNull().isNotEqualTo(personIdA);
    }

    private void assertLegacyContactColumnsAreGone(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "select count(*) from information_schema.columns "
                        + "where table_name = 'subscription' and column_name like 'responsible_contact_%'")) {
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                assertThat(resultSet.getInt(1)).isZero();
            }
        }
    }

    private void assertResponsiblePersonIdIsNotNullEnforced(Connection connection, UUID productId)
            throws SQLException {
        // Confirmed at the DB level, not just by reading the migration SQL — inserting a
        // responsible_person_id-less row post-migration must fail. Uses a brand-new Club with no
        // existing subscription so the only possible violation is the NOT NULL constraint being
        // asserted here, not ux_subscription_active_owner's unrelated one-ACTIVE-per-owner rule.
        UUID freshClub = seedClub(connection, "Acacia CC", "acacia-cc");

        assertThatThrownBy(() -> {
            try (PreparedStatement statement = connection.prepareStatement(
                    "insert into subscription (owner_id, product_id) values (?, ?)")) {
                statement.setObject(1, freshClub);
                statement.setObject(2, productId);
                statement.executeUpdate();
            }
        }).isInstanceOf(SQLException.class);
    }

    private UUID responsiblePersonId(Connection connection, UUID subscriptionId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "select responsible_person_id from subscription where id = ?")) {
            statement.setObject(1, subscriptionId);
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                return (UUID) resultSet.getObject(1);
            }
        }
    }

    private UUID seedClub(Connection connection, String name, String slug) throws SQLException {
        UUID id = UUID.randomUUID();
        try (PreparedStatement statement = connection.prepareStatement(
                "insert into club (id, name, slug, status) values (?, ?, ?, 'ACTIVE')")) {
            statement.setObject(1, id);
            statement.setString(2, name);
            statement.setString(3, slug);
            statement.executeUpdate();
        }
        return id;
    }

    private UUID seedProduct(Connection connection, String code) throws SQLException {
        UUID id = UUID.randomUUID();
        try (PreparedStatement statement =
                connection.prepareStatement("insert into product (id, code, name) values (?, ?, ?)")) {
            statement.setObject(1, id);
            statement.setString(2, code);
            statement.setString(3, code);
            statement.executeUpdate();
        }
        return id;
    }

    private UUID seedSubscription(
            Connection connection,
            UUID ownerId,
            UUID productId,
            String firstName,
            String lastName,
            String email,
            String phone)
            throws SQLException {
        UUID id = UUID.randomUUID();
        try (PreparedStatement statement = connection.prepareStatement(
                "insert into subscription "
                        + "(id, owner_id, product_id, responsible_contact_first_name, "
                        + "responsible_contact_last_name, responsible_contact_email, responsible_contact_phone) "
                        + "values (?, ?, ?, ?, ?, ?, ?)")) {
            statement.setObject(1, id);
            statement.setObject(2, ownerId);
            statement.setObject(3, productId);
            statement.setString(4, firstName);
            statement.setString(5, lastName);
            statement.setString(6, email);
            statement.setString(7, phone);
            statement.executeUpdate();
        }
        return id;
    }
}
