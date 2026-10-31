package com.cricketlegend.dto;

import jakarta.validation.constraints.NotNull;

/** Body of {@code PUT .../decisions} (docs/specs/097-import-framework.md): the revision the client last saw plus the decisions. */
public record ImportDecisionsRequest(int revision, @NotNull ImportDecisionsDto decisions) {
}
