package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/** docs/specs/097-import-framework.md: one record that blocks deleting an import, with stable reason codes and a link. */
public record DeletionBlockerDto(
        String entityType, UUID entityId, String label, List<String> reasons, String detail, String link) {

    public DeletionBlockerDto {
        reasons = reasons == null ? List.of() : reasons;
    }
}
