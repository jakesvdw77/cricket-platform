package com.cricketlegend.dto;

import java.util.List;

/**
 * docs/specs/103-player-stats.md, "API Contract (leaderboards)": the board catalogue, one source for the page so the client
 * never hard-codes a definition. {@code direction} is HIGHEST or LOWEST; {@code minimumKind} is NONE, INNINGS or OVERS;
 * {@code awardEligible} marks boards a club may pick as an award category and {@code awardDefault} the nine headline ones.
 */
public record LeaderboardCatalogueDto(List<LeaderboardCatalogueGroup> groups) {

    /**
     * One tab: BATTING, BOWLING, FIELDING or AWARDS. {@code code} is the lower-case route segment of the standings table
     * (batting, bowling, fielding; null for AWARDS), {@code columns} its fixed columns in display order (empty for AWARDS)
     * and {@code defaultSort} the column code sorted by default. {@code boards} lists the group's boards in display order
     * (the award categories a club may choose from are the ones with {@code awardEligible}).
     */
    public record LeaderboardCatalogueGroup(
            String group,
            String code,
            String label,
            String defaultSort,
            List<LeaderboardColumnInfo> columns,
            List<LeaderboardBoardInfo> boards) {
    }

    /**
     * One standings column: {@code code} is also the {@code sort} value; {@code label} is the short table heading and {@code longLabel} the full name; {@code direction} is HIGHEST or LOWEST (which end
     * ranks first); {@code minimumKind} is NONE, INNINGS or OVERS (the optional minimum available when sorting by it).
     */
    public record LeaderboardColumnInfo(
            String code, String label, String longLabel, boolean sortable, String direction, String minimumKind) {
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
