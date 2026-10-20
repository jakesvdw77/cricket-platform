package com.cricketlegend.dto;

import java.util.List;

/**
 * docs/specs/103-player-stats.md, "API Contract (leaderboards)": the board catalogue, one source for the page so the client
 * never hard-codes a definition. {@code direction} is HIGHEST or LOWEST; {@code minimumKind} is NONE, INNINGS or OVERS;
 * {@code awardEligible} marks boards a club may pick as an award category and {@code awardDefault} the nine headline ones.
 */
public record LeaderboardCatalogueDto(List<LeaderboardCatalogueGroup> groups) {

    /** One tab: BATTING, BOWLING, FIELDING or AWARDS, with its boards in display order. */
    public record LeaderboardCatalogueGroup(String group, String label, List<LeaderboardBoardInfo> boards) {
    }

    /** One board's definition, also echoed on every board page and awards category. */
    public record LeaderboardBoardInfo(
            String code,
            String group,
            String label,
            String figureLabel,
            String direction,
            String minimumKind,
            String help,
            boolean awardEligible,
            boolean awardDefault) {
    }
}
