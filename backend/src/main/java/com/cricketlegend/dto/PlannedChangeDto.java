package com.cricketlegend.dto;

import com.cricketlegend.domain.ImportEntityAction;
import java.util.Map;

/**
 * One record the commit will create or update (docs/specs/097-import-framework.md): the Review step lists all of
 * them, and the digest of that list is what the user confirms. For an update, {@code changes} holds
 * attribute to {@code {old, new}}.
 */
public record PlannedChangeDto(
        ImportEntityAction action,
        String entityType,
        String label,
        Integer rowNumber,
        Map<String, Object> detail,
        Map<String, Object> changes) {

    public PlannedChangeDto {
        detail = detail == null ? Map.of() : detail;
        changes = changes == null ? Map.of() : changes;
    }
}
