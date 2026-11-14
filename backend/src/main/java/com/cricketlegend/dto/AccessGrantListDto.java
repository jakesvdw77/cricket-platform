package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/**
 * The people list, shaped for the caller, per docs/specs/150 rule 8. {@code clubWideCount} is only filled when club-wide holders
 * are left out of {@code items} (a section viewer). The other fields tell the form what the server will accept.
 */
public record AccessGrantListDto(
        List<AccessGrantDto> items,
        int clubWideCount,
        boolean canManage,
        boolean canGrantClubWide,
        List<UUID> grantableSectionIds,
        List<RoleGrantabilityDto> roles) {}
