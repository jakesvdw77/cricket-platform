package com.cricketlegend.exception;

/** The import preview has expired or its stored rows were retired (docs/specs/097-import-framework.md). Maps to 409. */
public class ImportBatchExpiredException extends ConflictException {

    public ImportBatchExpiredException(String message) {
        super(message);
    }
}
