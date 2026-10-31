package com.cricketlegend.dto;

import com.cricketlegend.domain.ImportResolutionKind;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Everything the user decided so far on a batch (docs/specs/097-import-framework.md): rows excluded, values confirmed
 * as ours, how each unrecognised value is resolved, which differing rows to update, which warnings are acknowledged
 * and the type's own options. The server re-validates with these applied on every change.
 */
public record ImportDecisionsDto(
        List<Integer> excludedRows,
        List<String> identifiedAsOurs,
        List<Resolution> resolutions,
        List<RowUpdate> updates,
        boolean updateAllDiffering,
        List<Acknowledgement> acknowledgedWarnings,
        Map<String, Object> options,
        List<RowValues> rowEdits,
        List<RowValues> addedRows) {

    public ImportDecisionsDto {
        excludedRows = excludedRows == null ? List.of() : excludedRows;
        identifiedAsOurs = identifiedAsOurs == null ? List.of() : identifiedAsOurs;
        resolutions = resolutions == null ? List.of() : resolutions;
        updates = updates == null ? List.of() : updates;
        acknowledgedWarnings = acknowledgedWarnings == null ? List.of() : acknowledgedWarnings;
        options = options == null ? Map.of() : options;
        rowEdits = rowEdits == null ? List.of() : rowEdits;
        addedRows = addedRows == null ? List.of() : addedRows;
    }

    public static ImportDecisionsDto empty() {
        return new ImportDecisionsDto(null, null, null, null, false, null, null, null, null);
    }

    /**
     * {@code key} is the proposal key; LINK needs a target (id and or name), CREATE and SKIP_ROWS need none. {@code
     * abbreviation} is optional type data for a CREATE (spec 098: a new league team's abbreviation).
     */
    public record Resolution(
            String key,
            ImportResolutionKind kind,
            String targetKind,
            UUID targetId,
            String targetName,
            boolean remember,
            String abbreviation) {
    }

    /**
     * A row opted in to be updated. An empty or omitted {@code attributes} list means ALL the attributes the type
     * allows to be updated for that row; a non-empty list restricts the update to those attributes. Handlers that
     * apply updates must treat empty as all.
     */
    public record RowUpdate(int rowNumber, List<String> attributes) {

        public RowUpdate {
            attributes = attributes == null ? List.of() : attributes;
        }
    }

    /**
     * Spec 125: the manager's text for a row. In {@code rowEdits} only the changed column keys of a file row; in
     * {@code addedRows} a whole new row (number 1001 upward). Values are plain text, never markup.
     */
    public record RowValues(int rowNumber, Map<String, String> values) {

        public RowValues {
            values = values == null ? Map.of() : values;
        }
    }

    /** {@code rowNumbers} null or empty acknowledges every row of that warning code. */
    public record Acknowledgement(String code, List<Integer> rowNumbers) {
    }
}
