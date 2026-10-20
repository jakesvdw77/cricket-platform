package com.cricketlegend.dto;

import java.util.List;

/**
 * docs/specs/103-player-stats.md, decision 18, request and response of
 * {@code /api/v1/manage/clubs/{clubId}/leaderboard-settings}. {@code awardCategories} is the effective list of board codes
 * shown on the Awards view (the nine defaults when the club has not chosen). {@code selectableCategories} is every code that
 * may be chosen; it is sent on the response and ignored on the request.
 */
public record LeaderboardSettingsDto(List<String> awardCategories, List<String> selectableCategories) {
}
