package com.cricketlegend.dto;

import java.util.List;
import java.util.Map;

/**
 * A club's sharing settings, used for both the request and the response of
 * {@code /api/v1/manage/clubs/{clubId}/share-settings}. {@code initialsOnlyDefault} is the club-wide
 * default for whether a shared result shows players by initials only (docs/specs/114-share-result.md).
 * {@code disabledFormats} maps a content type ({@code RESULT}, {@code LEAGUE}) to the format codes the club has
 * switched off (docs/specs/122-league-sharing.md). On a request, null leaves the stored value as is; a response
 * always carries a map.
 */
public record ShareSettingsDto(boolean initialsOnlyDefault, Map<String, List<String>> disabledFormats) {
}
