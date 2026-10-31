package com.cricketlegend.exception;

/**
 * An uploaded import file is refused before any batch exists: wrong type or extension, too large, too many rows,
 * merged cells, the wrong template or version, or unreadable (docs/specs/097-import-framework.md). Maps to HTTP 400 via
 * {@link ValidationException}. Deliberately distinct from the spec 104 result-import exceptions. The message never
 * contains file content or cell values.
 */
public class ImportFileRejectedException extends ValidationException {

    public ImportFileRejectedException(String message) {
        super(message);
    }
}
