package com.cricketlegend.dto;

import com.cricketlegend.domain.PlayingAreaCategory;
import com.cricketlegend.domain.PlayingAreaOwnerType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Create/edit payload of a field (docs/specs/099-fields-directory.md), for the club-scoped POST/PUT and the platform
 * PUT alike. {@code areaType} is deliberately absent: the service forces {@code CRICKET_FIELD}. Street, city and
 * country (an ISO 3166-1 alpha-2 code) are required inside {@code address}, enforced in the service because every
 * {@link AddressDto} component is optional elsewhere. {@code mapUrl} must be https.
 */
public record PlayingAreaRequest(
        @NotBlank @Size(max = 200) String name,
        @NotNull PlayingAreaCategory category,
        @NotNull PlayingAreaOwnerType ownerType,
        @NotBlank @Size(max = 200) String ownerName,
        @NotNull @Valid AddressDto address,
        @Size(max = 500) String mapUrl,
        @Size(max = 500) String locationNotes) {
}
