package com.cricketlegend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Turns on {@code @Scheduled} processing — introduced for the availability auto-close job
 * (docs/specs/064-unified-availability-polls.md), the first scheduled work in this codebase. The job
 * itself checks {@code cricketlegend.autoclose.enabled} each tick (default true; false in {@code
 * src/test/resources/config/application.properties}) so nothing fires inside integration tests.
 * Single-node only: no distributed lock, matching how the backend runs today.
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
