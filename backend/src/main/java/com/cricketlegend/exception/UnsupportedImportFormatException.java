package com.cricketlegend.exception;

import java.util.List;

/**
 * docs/specs/104-match-results-import-adaptors.md: the adaptor does not take this input format (or a binary format was
 * pasted). Carries the format asked for and the formats the adaptor supports. Maps to 400.
 */
public class UnsupportedImportFormatException extends InvalidImportInputException {

    private final String requested;
    private final transient List<String> supported;

    public UnsupportedImportFormatException(String requested, List<String> supported, String message) {
        super(message);
        this.requested = requested;
        this.supported = List.copyOf(supported);
    }

    public String getRequested() {
        return requested;
    }

    public List<String> getSupported() {
        return supported;
    }
}
