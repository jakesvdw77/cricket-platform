package com.cricketlegend.dto;

/**
 * docs/specs/117-stats-dashboard.md, "Caps and ordering": the two named limits behind every Dashboard series, shared by the
 * player and the team response. Per-match bar and line charts return the most recent {@code pointLimit} points; running
 * trends and donuts cover every counted match up to {@code historyCap} (newest kept, {@code truncated} on the response when
 * more existed).
 */
public record DashboardWindowDto(int pointLimit, int historyCap) {
}
