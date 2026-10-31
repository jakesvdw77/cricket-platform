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
 * Proves 058-add-import-framework.sql applies, and that 059-import-batch-source-manual.sql widens the
 * {@code import_batch.source} check to accept MANUAL over existing rows (docs/specs/097-import-framework.md,
 * docs/specs/125-editable-import-rows.md), while an unknown source is still rejected.
 *
 * <p>Same technique as {@link TeamSelectionMigrationTest}: Liquibase driven directly against a raw Testcontainers
 * Postgres in two passes, the first through a test-only changelog that stops at 058.
 */
@Testcontainers
class ImportFrameworkMigrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    @Test
    void migration058CreatesTheTablesAndMigration059AcceptsManualOverExistingRows() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            Database database =
                    DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection));

            new Liquibase("db/changelog/changelog-through-058-test-only.xml", new ClassLoaderResourceAccessor(), database)
                    .update(new Contexts(), new LabelExpression());
            connection.setAutoCommit(true);

            // 058 applied: both tables exist
            assertThat(tableExists(connection, "import_batch")).isTrue();
            assertThat(tableExists(connection, "import_batch_entity")).isTrue();

            UUID club = UUID.randomUUID();
            try (PreparedStatement s = connection.prepareStatement(
                    "insert into club (id, name, slug, status) values (?, 'Riverside CC', 'riverside', 'ACTIVE')")) {
                s.setObject(1, club);
                s.executeUpdate();
            }
            UUID template = batch(connection, club, "TEMPLATE_FILE");
            UUID ai = batch(connection, club, "AI_TRANSFORM");

            // before 059 MANUAL is refused, as is an unknown source
            assertThatThrownBy(() -> batch(connection, club, "MANUAL")).isInstanceOf(SQLException.class);

            new Liquibase("db/changelog/db.changelog-master.xml", new ClassLoaderResourceAccessor(), database)
                    .update(new Contexts(), new LabelExpression());
            connection.setAutoCommit(true);

            // existing rows untouched
            assertThat(sourceOf(connection, template)).isEqualTo("TEMPLATE_FILE");
            assertThat(sourceOf(connection, ai)).isEqualTo("AI_TRANSFORM");

            // MANUAL now accepted, the others still are, unknown still rejected
            UUID manual = batch(connection, club, "MANUAL");
            assertThat(sourceOf(connection, manual)).isEqualTo("MANUAL");
            batch(connection, club, "TEMPLATE_FILE");
            batch(connection, club, "AI_TRANSFORM");
            assertThatThrownBy(() -> batch(connection, club, "CARRIER_PIGEON")).isInstanceOf(SQLException.class);
        }
    }

    private boolean tableExists(Connection c, String table) throws SQLException {
        try (PreparedStatement s = c.prepareStatement("select to_regclass(?) is not null")) {
            s.setString(1, "public." + table);
            try (ResultSet r = s.executeQuery()) {
                r.next();
                return r.getBoolean(1);
            }
        }
    }

    private UUID batch(Connection c, UUID club, String source) throws SQLException {
        UUID id = UUID.randomUUID();
        try (PreparedStatement s = c.prepareStatement(
                "insert into import_batch (id, club_id, type, template_version, source, status, scope_key, scope,"
                        + " file_name, file_sha256, file_size_bytes, created_by)"
                        + " values (?, ?, 'LEAGUE_SCHEDULE', 1, ?, 'PREVIEW', 'k', '{}'::jsonb, 'f.csv', 'abc', 1, ?)")) {
            s.setObject(1, id);
            s.setObject(2, club);
            s.setString(3, source);
            s.setObject(4, UUID.randomUUID());
            s.executeUpdate();
        }
        return id;
    }

    private String sourceOf(Connection c, UUID id) throws SQLException {
        try (PreparedStatement s = c.prepareStatement("select source from import_batch where id = ?")) {
            s.setObject(1, id);
            try (ResultSet r = s.executeQuery()) {
                assertThat(r.next()).isTrue();
                return r.getString(1);
            }
        }
    }
}
