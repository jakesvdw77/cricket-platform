package com.cricketlegend.dto;

/** Body of {@code POST .../delete} (docs/specs/097-import-framework.md): {@code confirm} must be true. */
public record DeleteImportRequest(boolean confirm) {
}
