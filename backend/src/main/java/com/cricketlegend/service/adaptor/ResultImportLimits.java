package com.cricketlegend.service.adaptor;

/**
 * docs/specs/104-match-results-import-adaptors.md, "File and size limits": the one place the import size caps live. The
 * discovery endpoint returns them so the UI never hard-codes them. An uploaded file is also bound by the global
 * multipart limit ({@code spring.servlet.multipart.max-file-size}, 5 MB), which this never exceeds.
 */
public final class ResultImportLimits {

    /** The global multipart limit, mirrored here so an adaptor cannot declare a larger one. */
    public static final long GLOBAL_MAX_FILE_BYTES = 5L * 1024 * 1024;
    public static final long TEXT_FILE_MAX_BYTES = 2L * 1024 * 1024;
    public static final long BINARY_FILE_MAX_BYTES = 5L * 1024 * 1024;
    public static final int MAX_PASTE_CHARACTERS = 1_000_000;
    public static final int MAX_PLAYERS_PER_SIDE = 30;
    public static final int MAX_REGULAR_INNINGS = 2;
    public static final int MAX_NAME_LENGTH = 100;
    public static final int MAX_REPORTED_ERRORS = 50;

    private ResultImportLimits() {}
}
