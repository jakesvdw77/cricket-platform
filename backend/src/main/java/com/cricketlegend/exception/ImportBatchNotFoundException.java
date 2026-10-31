package com.cricketlegend.exception;

/** No such import batch in this club, or it belongs to another club (docs/specs/097-import-framework.md). Maps to 404. */
public class ImportBatchNotFoundException extends NotFoundException {

    public ImportBatchNotFoundException() {
        super("Import not found");
    }
}
