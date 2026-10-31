package com.cricketlegend.dto;

import java.util.List;
import java.util.Map;

/**
 * docs/specs/097-import-framework.md: can this import be deleted, what would go and what would be kept. Never writes.
 * {@code notes} are plain sentences that never block (spec 098: edited since import, already played, deactivated, a
 * league team that is kept and why).
 */
public record DeletionCheckDto(
        boolean deletable,
        List<DeletionBlockerDto> blockers,
        Map<String, Integer> willDelete,
        Map<String, Integer> willKeep,
        List<String> notes) {

    public DeletionCheckDto {
        blockers = blockers == null ? List.of() : blockers;
        willDelete = willDelete == null ? Map.of() : willDelete;
        willKeep = willKeep == null ? Map.of() : willKeep;
        notes = notes == null ? List.of() : notes;
    }
}
