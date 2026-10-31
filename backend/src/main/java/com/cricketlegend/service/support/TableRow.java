package com.cricketlegend.service.support;

import java.util.Map;

/**
 * One data row read from a spreadsheet or CSV: the physical row (or line) number, a reference for messages
 * ("Schedule!C14", "line 14"), the trimmed text of each known column by canonical name and each cell's own reference.
 */
public record TableRow(int rowNumber, String sourceRef, Map<String, String> values, Map<String, String> cellRefs) {

    public String value(String column) {
        return values.getOrDefault(column, "");
    }
}
