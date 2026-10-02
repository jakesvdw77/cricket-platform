package com.cricketlegend.service;

import java.time.Instant;

/**
 * Closes every availability poll (squad and group) whose autoclose time has passed
 * (docs/specs/064-unified-availability-polls.md). Driven by a scheduler in the implementation;
 * {@link #closeDuePolls} is also callable directly (tests, ops).
 */
public interface AvailabilityAutoCloseService {

    /**
     * Closes all due open polls of both kinds as of {@code now}. Idempotent.
     *
     * @return total number of polls closed (squad + group)
     */
    int closeDuePolls(Instant now);
}
