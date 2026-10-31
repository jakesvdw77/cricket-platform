package com.cricketlegend.dto;

import java.util.List;

/**
 * docs/specs/097-import-framework.md: one import type the club can use, so the UI renders entry points generically.
 * Spec 125: {@code editable} and {@code editableColumns} say which values the wizard may edit (the UI renders its inputs
 * from them, never hard-coded).
 */
public record ImportTypeDto(
        String type,
        String label,
        int templateVersion,
        List<String> formats,
        boolean supportsOursScope,
        ImportFileLimitsDto limits,
        boolean editable,
        List<EditableColumn> editableColumns) {

    public ImportTypeDto {
        editableColumns = editableColumns == null ? List.of() : editableColumns;
    }

    /** {@code kind} is only a hint for the input: TEXT, DATE or TIME. */
    public record EditableColumn(String key, String label, Kind kind) {
    }

    public enum Kind { TEXT, DATE, TIME }
}
