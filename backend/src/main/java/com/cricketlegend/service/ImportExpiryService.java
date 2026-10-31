package com.cricketlegend.service;

import java.time.Instant;

/** docs/specs/097-import-framework.md: the cleanup of expired previews and retired payloads. */
public interface ImportExpiryService {

    /**
     * Marks PREVIEW batches past their expiry EXPIRED (payload nulled), nulls the payload of committed batches 30 days
     * after commit and removes the metadata of never-committed batches after 90 days. Returns the number of rows touched.
     */
    int runExpiry(Instant now);
}
