package com.cricketlegend.exception;

import com.cricketlegend.dto.ImportBatchDto;
import com.cricketlegend.dto.ImportIssueDto;
import java.util.List;

/**
 * Commit re-validation against the live data found errors or unacknowledged warnings (docs/specs/097-import-framework.md).
 * Maps to HTTP 400 via {@link ValidationException}; {@code GlobalExceptionHandler} adds {@link #getIssues()} and the
 * freshly stored {@link #getBatch()} to the problem body. Nothing was written.
 */
public class ImportValidationFailedException extends ValidationException {

    private final transient List<ImportIssueDto> issues;
    private final transient ImportBatchDto batch;

    public ImportValidationFailedException(String message, List<ImportIssueDto> issues, ImportBatchDto batch) {
        super(message);
        this.issues = issues == null ? List.of() : List.copyOf(issues);
        this.batch = batch;
    }

    public List<ImportIssueDto> getIssues() {
        return issues;
    }

    public ImportBatchDto getBatch() {
        return batch;
    }
}
