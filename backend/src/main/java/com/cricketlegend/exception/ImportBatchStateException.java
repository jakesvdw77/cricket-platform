package com.cricketlegend.exception;

import com.cricketlegend.dto.ImportBatchDto;

/**
 * The batch is not in a state that allows the action, the client's revision is stale, a limit is reached, or the live
 * data changed since the review (docs/specs/097-import-framework.md). Maps to 409 via {@link ConflictException}. When
 * the cause is changed data, {@link #getBatch()} carries the freshly stored review state so the client can show it.
 */
public class ImportBatchStateException extends ConflictException {

    private final transient ImportBatchDto batch;

    public ImportBatchStateException(String message) {
        this(message, null);
    }

    public ImportBatchStateException(String message, ImportBatchDto batch) {
        super(message);
        this.batch = batch;
    }

    /** The fresh state of the batch, or null when the conflict has nothing new to show. */
    public ImportBatchDto getBatch() {
        return batch;
    }
}
