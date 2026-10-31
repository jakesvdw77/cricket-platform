package com.cricketlegend.dto;

/**
 * docs/specs/097-import-framework.md: the limits the client shows on the Upload step (values come from ImportLimits).
 * Named apart from the spec 104 result-import {@code ImportLimitsDto}.
 */
public record ImportFileLimitsDto(
        long maxFileBytes,
        int maxRows,
        int maxCellCharacters,
        int maxOpenPreviewsPerUser,
        int maxOpenPreviewsPerClub,
        int maxPreviewsPerClubPerHour) {
}
