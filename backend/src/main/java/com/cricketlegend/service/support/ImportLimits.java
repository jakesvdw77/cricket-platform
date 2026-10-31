package com.cricketlegend.service.support;

import com.cricketlegend.dto.ImportFileLimitsDto;
import java.time.Duration;

/**
 * Every import limit in one place (docs/specs/097-import-framework.md, "File limits and rate limits"). Documented in a
 * template's Instructions sheet and returned by {@code GET /imports/types}. The 2 MB file limit sits below the global
 * 5 MB multipart limit, which is left unchanged.
 */
public final class ImportLimits {

    public static final long MAX_FILE_BYTES = 2L * 1024 * 1024;
    public static final int MAX_ROWS = 1_000;
    public static final int MAX_CELL_CHARACTERS = 1_000;
    public static final int MAX_OPEN_PREVIEWS_PER_USER = 5;
    public static final int MAX_OPEN_PREVIEWS_PER_CLUB = 20;
    public static final int MAX_PREVIEWS_PER_CLUB_PER_HOUR = 30;
    /** Rows in the first page sent with a preview and the default page of the rows endpoint. */
    public static final int FIRST_PAGE_SIZE = 50;
    /** Largest page the rows endpoint serves. */
    public static final int MAX_PAGE_SIZE = 200;

    /** Preview expiry, counted from the last change. */
    public static final Duration IMPORT_PREVIEW_TTL = Duration.ofHours(24);
    /** Confirmation token validity. */
    public static final Duration IMPORT_TOKEN_TTL = Duration.ofMinutes(30);
    /** Metadata of batches that never committed is kept this long. */
    public static final Duration IMPORT_BATCH_RETENTION = Duration.ofDays(90);
    /** A committed batch keeps its row payload this long after commit. */
    public static final Duration IMPORT_PAYLOAD_RETENTION = Duration.ofDays(30);

    private ImportLimits() {
    }

    public static ImportFileLimitsDto asDto() {
        return new ImportFileLimitsDto(
                MAX_FILE_BYTES,
                MAX_ROWS,
                MAX_CELL_CHARACTERS,
                MAX_OPEN_PREVIEWS_PER_USER,
                MAX_OPEN_PREVIEWS_PER_CLUB,
                MAX_PREVIEWS_PER_CLUB_PER_HOUR);
    }
}
