package com.cricketlegend.dto;

import com.cricketlegend.domain.PlayingAreaCategory;
import com.cricketlegend.domain.PlayingAreaOwnerType;
import com.cricketlegend.domain.PlayingAreaType;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * A field as the platform admin sees it (docs/specs/099-fields-directory.md): the moderation list and detail. {@code
 * matchCount} is every match (any club, any state) on the field. {@code linkedClubs} is filled on list and detail;
 * {@code possibleDuplicates} only on the detail (empty on the list, to avoid a similarity query per row).
 * {@code mergedIntoId} is set only for a field merged away.
 */
public record PlatformPlayingAreaDto(
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
        String verifiedBySubject,
        String rejectionReason,
        UUID createdByClubId,
        String createdByClubName,
        UUID mergedIntoId,
        long matchCount,
        List<PlayingAreaLinkedClubDto> linkedClubs,
        List<PlayingAreaRefDto> possibleDuplicates,
        Instant createdAt,
        Instant updatedAt) {
}
