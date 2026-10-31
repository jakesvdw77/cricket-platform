package com.cricketlegend.service.support;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * What {@link XlsxTableReader} and {@link CsvTableReader} produce: the canonical header names found, headers that matched
 * no known column, the non-blank data rows, the hidden {@code _meta} entries (xlsx only) and file-level warnings.
 */
public record TableData(
        List<String> headers,
        List<String> unknownHeaders,
        List<TableRow> rows,
        Map<String, String> meta,
        List<String> warnings) {

    /** The required canonical columns that are absent from the header. */
    public List<String> missingColumns(Collection<String> required) {
        List<String> missing = new ArrayList<>();
        for (String column : required) {
            if (!headers.contains(column)) {
                missing.add(column);
            }
        }
        return missing;
    }
}
