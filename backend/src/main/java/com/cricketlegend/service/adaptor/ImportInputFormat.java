package com.cricketlegend.service.adaptor;

import java.util.List;

/**
 * docs/specs/104-match-results-import-adaptors.md: the shape of the bytes an adaptor is given. Text-based formats can be
 * uploaded or pasted; binary formats only uploaded. {@code defaultMaxBytes} is the upload limit unless an adaptor
 * declares a lower one (never above the global multipart limit, see {@link ResultImportLimits}).
 */
public enum ImportInputFormat {
    JSON(true, ResultImportLimits.TEXT_FILE_MAX_BYTES, List.of(".json")),
    CSV(true, ResultImportLimits.TEXT_FILE_MAX_BYTES, List.of(".csv")),
    EXCEL(false, ResultImportLimits.BINARY_FILE_MAX_BYTES, List.of(".xlsx", ".xls")),
    PDF(false, ResultImportLimits.BINARY_FILE_MAX_BYTES, List.of(".pdf"));

    private final boolean textBased;
    private final long defaultMaxBytes;
    private final List<String> extensions;

    ImportInputFormat(boolean textBased, long defaultMaxBytes, List<String> extensions) {
        this.textBased = textBased;
        this.defaultMaxBytes = defaultMaxBytes;
        this.extensions = extensions;
    }

    public boolean isTextBased() {
        return textBased;
    }

    public long getDefaultMaxBytes() {
        return defaultMaxBytes;
    }

    /** File extensions (lower case, with the dot) the upload control should offer. */
    public List<String> getExtensions() {
        return extensions;
    }
}
