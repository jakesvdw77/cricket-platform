package com.cricketlegend.dto;

import java.util.UUID;

/**
 * A section in the "which section" picker of the link request form ({@code GET /api/v1/me/clubs/{clubId}/sections}).
 * {@code groupLabel} is the parent section's name, when there is one.
 */
public record SectionOptionDto(UUID id, String name, String groupLabel) {}
