package com.cricketlegend.dto;

import java.util.UUID;

/** A club linked to a field, for the platform detail (docs/specs/099-fields-directory.md). */
public record PlayingAreaLinkedClubDto(UUID clubId, String clubName, boolean home) {
}
