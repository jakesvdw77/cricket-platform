package com.cricketlegend.dto;

import com.cricketlegend.domain.PlayingAreaCategory;
import com.cricketlegend.domain.PlayingAreaOwnerType;
import com.cricketlegend.domain.PlayingAreaType;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import java.time.Instant;
import java.util.UUID;

/**
 * A field as a club manager sees it (docs/specs/099-fields-directory.md): list item, detail and "did you mean"
 * suggestion alike. {@code linkedHome} is whether the calling club has the field as a home field; {@code matchCount}
 * is that club's active matches played on it; {@code createdByClubName} is null when a platform admin captured it.
 */
public record PlayingAreaDto(
        UUID id,
        PlayingAreaType areaType,
        String name,
        PlayingAreaCategory category,
        PlayingAreaOwnerType ownerType,
        String ownerName,
        AddressDto address,
        String mapUrl,
        String locationNotes,
        PlayingAreaVerificationStatus verificationStatus,
        Instant verifiedAt,
        String rejectionReason,
        UUID createdByClubId,
        String createdByClubName,
        boolean linkedHome,
        long matchCount,
        Instant createdAt) {
}
