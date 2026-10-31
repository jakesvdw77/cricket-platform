package com.cricketlegend.service.support;

import com.cricketlegend.service.support.schedule.ScheduleRows;
import com.cricketlegend.domain.ImportRowOrigin;
import com.cricketlegend.dto.ImportDecisionsDto;
import com.cricketlegend.dto.ImportRowDto;
import com.cricketlegend.dto.ImportTypeDto;
import com.cricketlegend.exception.ValidationException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The one place the manager's edits and added rows are applied (docs/specs/125-editable-import-rows.md): effective
 * rows are the file's parsed rows with the edits overlaid, plus the added rows. Exclusion is a separate step
 * ({@link ImportReview}). Pure: no Spring, no access information. Messages never contain a cell value.
 */
public final class ImportRowEditor {

    /** The first number an added row can have; above the 1,000-row file limit so it never clashes with a file row. */
    public static final int FIRST_ADDED_ROW = 1001;

    private ImportRowEditor() {
    }

    /** Throws a plain {@link ValidationException} when the edits or added rows are not acceptable. */
    public static void validate(
            List<ImportRowDto> fileRows,
            ImportDecisionsDto decisions,
            List<ImportTypeDto.EditableColumn> editableColumns) {
        if (decisions.rowEdits().isEmpty() && decisions.addedRows().isEmpty()) {
            return;
        }
        Set<String> keys = new HashSet<>();
        editableColumns.forEach(column -> keys.add(column.key()));
        if (keys.isEmpty()) {
            throw new ValidationException("This type of import cannot be edited in the wizard.");
        }
        Set<Integer> fileNumbers = new HashSet<>();
        fileRows.forEach(row -> fileNumbers.add(row.rowNumber()));

        Set<Integer> edited = new HashSet<>();
        for (ImportDecisionsDto.RowValues edit : decisions.rowEdits()) {
            if (!fileNumbers.contains(edit.rowNumber())) {
                throw new ValidationException(ScheduleRows.label(edit.rowNumber()) + " does not exist in this import, so it cannot be edited.");
            }
            if (!edited.add(edit.rowNumber())) {
                throw new ValidationException(ScheduleRows.label(edit.rowNumber()) + " has been edited more than once in the same change.");
            }
            checkValues(edit, keys);
        }
        Set<Integer> added = new HashSet<>();
        for (ImportDecisionsDto.RowValues row : decisions.addedRows()) {
            if (row.rowNumber() < FIRST_ADDED_ROW) {
                throw new ValidationException("Added rows are numbered from " + FIRST_ADDED_ROW + " upward.");
            }
            if (!added.add(row.rowNumber()) || fileNumbers.contains(row.rowNumber())) {
                throw new ValidationException(ScheduleRows.label(row.rowNumber()) + " is listed more than once.");
            }
            checkValues(row, keys);
        }
        if (fileRows.size() + decisions.addedRows().size() > ImportLimits.MAX_ROWS) {
            throw new ValidationException("An import can have at most " + ImportLimits.MAX_ROWS + " rows, including rows you added.");
        }
    }

    /**
     * The effective rows: file rows (edited ones marked EDITED with the file's original values of the changed keys; an
     * edit that equals the file's value is dropped), then the added rows in number order (ADDED, no source reference).
     */
    public static List<ImportRowDto> apply(
            List<ImportRowDto> fileRows,
            ImportDecisionsDto decisions,
            List<ImportTypeDto.EditableColumn> editableColumns) {
        Map<Integer, Map<String, String>> edits = new HashMap<>();
        decisions.rowEdits().forEach(edit -> edits.put(edit.rowNumber(), edit.values()));
        List<ImportRowDto> out = new ArrayList<>(fileRows.size() + decisions.addedRows().size());
        for (ImportRowDto row : fileRows) {
            Map<String, String> edit = edits.get(row.rowNumber());
            out.add(edit == null ? row : overlay(row, edit));
        }
        decisions.addedRows().stream()
                .sorted(Comparator.comparingInt(ImportDecisionsDto.RowValues::rowNumber))
                .forEach(added -> out.add(added(added, editableColumns)));
        return out;
    }

    private static ImportRowDto overlay(ImportRowDto row, Map<String, String> edit) {
        Map<String, Object> values = new LinkedHashMap<>(row.values());
        Map<String, Object> fileValues = new LinkedHashMap<>();
        edit.forEach((key, text) -> {
            String now = text == null ? "" : text;
            Object original = row.values().get(key);
            String before = original == null ? "" : original.toString();
            if (!now.equals(before)) {
                fileValues.put(key, before);
                values.put(key, now);
            }
        });
        if (fileValues.isEmpty()) {
            return row;
        }
        return new ImportRowDto(row.rowNumber(), row.sourceRef(), values, row.status(), row.outcome(), row.action(),
                row.issueCodes(), row.existingRef(), ImportRowOrigin.EDITED, fileValues);
    }

    private static ImportRowDto added(ImportDecisionsDto.RowValues added, List<ImportTypeDto.EditableColumn> columns) {
        Map<String, Object> values = new LinkedHashMap<>();
        columns.forEach(column -> values.put(column.key(), ""));
        added.values().forEach((key, text) -> values.put(key, text == null ? "" : text));
        return new ImportRowDto(added.rowNumber(), null, values, null, null, null, List.of(), null,
                ImportRowOrigin.ADDED, null);
    }

    private static void checkValues(ImportDecisionsDto.RowValues row, Set<String> keys) {
        for (Map.Entry<String, String> entry : row.values().entrySet()) {
            if (!keys.contains(entry.getKey())) {
                throw new ValidationException(ScheduleRows.label(row.rowNumber()) + " has a column that cannot be edited.");
            }
            if (entry.getValue() != null && entry.getValue().length() > ImportLimits.MAX_CELL_CHARACTERS) {
                throw new ValidationException("A value in " + ScheduleRows.label(row.rowNumber()) + " is longer than "
                        + ImportLimits.MAX_CELL_CHARACTERS + " characters.");
            }
        }
    }
}
