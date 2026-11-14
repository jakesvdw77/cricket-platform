package com.cricketlegend.support;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Migration 064 seeds the five built-in access roles (docs/specs/150). A test that runs {@code TRUNCATE ... CASCADE} on
 * {@code club} wipes them too, because {@code access_role.club_id} references {@code club}, and every later test in the
 * same database would then find no roles and refuse every manager. Call {@link #restore} after such a truncate.
 */
public final class AccessRoleSeed {

    private AccessRoleSeed() {}

    public static void restore(JdbcTemplate jdbc) {
        try {
            String sql = new ClassPathResource("db/changelog/v1/064-access-roles.sql")
                    .getContentAsString(StandardCharsets.UTF_8);
            for (String statement : sql.split(";\\s*\\n")) {
                String trimmed = statement.trim();
                int insert = trimmed.indexOf("INSERT INTO access_role");
                if (insert >= 0) {
                    jdbc.execute(trimmed.substring(insert) + " ON CONFLICT DO NOTHING");
                }
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
