package com.cricketlegend.dto;

import com.cricketlegend.domain.ImportOutcome;
import com.cricketlegend.domain.ImportRowOrigin;
import com.cricketlegend.domain.ImportRowAction;
import com.cricketlegend.domain.ImportRowStatus;
import java.util.List;
import java.util.Map;

/**
 * One normalised row of an import (docs/specs/097-import-framework.md). {@code values} holds JSON-simple values only
 * (strings, numbers, booleans) keyed by the type's canonical column names; {@code sourceRef} says where it came from
 * ("Schedule!C14", "line 14"). A row's status is its worst issue. {@code existingRef} points at a matching record.
 * {@code origin} (spec 125; null means FILE) says whether the manager edited or added the row; {@code fileValues} is
 * set only for an EDITED row: the file's original values of the changed keys.
 */
public record ImportRowDto(
        int rowNumber,
        String sourceRef,
        Map<String, Object> values,
        ImportRowStatus status,
        ImportOutcome outcome,
        ImportRowAction action,
        List<String> issueCodes,
        String existingRef,
        ImportRowOrigin origin,
        Map<String, Object> fileValues) {

    public ImportRowDto {
        values = values == null ? Map.of() : values;
        issueCodes = issueCodes == null ? List.of() : issueCodes;
    }

    /** The pre-spec-125 shape: a file row. */
    public ImportRowDto(
            int rowNumber,
            String sourceRef,
            Map<String, Object> values,
            ImportRowStatus status,
            ImportOutcome outcome,
            ImportRowAction action,
            List<String> issueCodes,
            String existingRef) {
        this(rowNumber, sourceRef, values, status, outcome, action, issueCodes, existingRef, ImportRowOrigin.FILE, null);
    }

    public ImportRowDto withResult(
            ImportRowStatus newStatus,
            ImportOutcome newOutcome,
            ImportRowAction newAction,
            List<String> newIssueCodes,
            String newExistingRef) {
        return new ImportRowDto(rowNumber, sourceRef, values, newStatus, newOutcome, newAction, newIssueCodes, newExistingRef,
                origin, fileValues);
    }
}
