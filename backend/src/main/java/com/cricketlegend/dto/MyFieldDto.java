package com.cricketlegend.dto;

import java.util.UUID;

/**
 * docs/specs/121, the Field Directory row for {@code GET /api/v1/me/players/{playerKey}/fields}. Response only. Named
 * {@code MyFieldDto} to sit beside the other {@code My*} DTOs and apart from the manager-side field types (099); the
 * schema in the API is {@code FieldDto}. Deliberately carries nothing manager-only: no verification internals,
 * created-by club, ground, area type, merge target, counts or linked clubs.
 */
public record MyFieldDto(
        UUID id,
        String name,
        String owner,
        String addressLine1,
        String city,
        String provinceState,
        String postalCode,
        String country,
        String mapUrl,
        boolean verified,
        boolean home) {
}
