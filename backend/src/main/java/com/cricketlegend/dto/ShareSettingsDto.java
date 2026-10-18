package com.cricketlegend.dto;

/**
 * A club's sharing settings, used for both the request and the response of
 * {@code /api/v1/manage/clubs/{clubId}/share-settings}. {@code initialsOnlyDefault} is the club-wide
 * default for whether a shared result shows players by initials only. See docs/specs/114-share-result.md.
 */
public record ShareSettingsDto(boolean initialsOnlyDefault) {
}
