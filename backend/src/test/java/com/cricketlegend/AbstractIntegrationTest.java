package com.cricketlegend;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Base for integration tests needing a real Postgres — per testing.md's integration tier.
 * Spins up a disposable container per test run instead of relying on a local dev database.
 */
@TestConfiguration(proxyBeanMethods = false)
public class AbstractIntegrationTest {

    @Bean
    @ServiceConnection
    PostgreSQLContainer<?> postgresContainer() {
        return new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));
    }
}
