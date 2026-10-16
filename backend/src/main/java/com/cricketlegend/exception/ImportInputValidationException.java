package com.cricketlegend.exception;

import com.cricketlegend.dto.ImportErrorDto;
import java.util.List;

/**
 * docs/specs/104-match-results-import-adaptors.md: the input is readable but wrong for the adaptor or for the common
 * import format. Carries up to {@link #MAX_ERRORS} errors and the total found. Maps to 400.
 */
public class ImportInputValidationException extends InvalidImportInputException {

    /** The most errors reported to the client (docs/specs/104, "File and size limits"). */
    public static final int MAX_ERRORS = 50;

    private final transient List<ImportErrorDto> errors;
    private final int totalErrors;

    public ImportInputValidationException(String message, List<ImportErrorDto> allErrors) {
        super(message);
        this.totalErrors = allErrors.size();
        this.errors = List.copyOf(allErrors.subList(0, Math.min(allErrors.size(), MAX_ERRORS)));
    }

    public List<ImportErrorDto> getErrors() {
        return errors;
    }

    /** How many errors there were before the list was capped. */
    public int getTotalErrors() {
        return totalErrors;
    }
}
