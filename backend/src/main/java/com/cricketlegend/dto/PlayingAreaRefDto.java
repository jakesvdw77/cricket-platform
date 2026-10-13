package com.cricketlegend.dto;

import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import java.util.UUID;

/** A compact field reference, used for the platform detail's possible duplicates (docs/specs/099-fields-directory.md). */
public record PlayingAreaRefDto(
        UUID id, String name, String city, String country, PlayingAreaVerificationStatus verificationStatus) {
}
