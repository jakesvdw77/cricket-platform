package com.cricketlegend.dto;

import java.util.UUID;

/**
 * One chip of the My players selector (docs/specs/119). {@code key} is the person link id, or {@code self:<profileId>}
 * for the caller's own record (listed first); {@code main} is true for the main agent of a linked player and always
 * false for the own record. No date of birth.
 */
public record MyPlayerSummaryDto(
        String key,
        String firstName,
        String lastName,
        String photoUrl,
        UUID clubId,
        String clubName,
        String groupLabel,
        boolean self,
        boolean main) {
}
