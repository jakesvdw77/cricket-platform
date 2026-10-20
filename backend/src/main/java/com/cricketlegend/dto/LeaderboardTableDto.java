package com.cricketlegend.dto;

import com.cricketlegend.dto.LeaderboardCatalogueDto.LeaderboardColumnInfo;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * docs/specs/103-player-stats.md, "Standings tables (decision 26)": one page of one standings table (group = batting,
 * bowling or fielding) sorted and ranked by one column, for the filters echoed in {@code scope}. {@code columns} is the
 * group's fixed column list in display order; every row carries a value for every column in {@code values}, keyed by
 * {@link LeaderboardColumnInfo#code()}. Every figure is the {@code PlayerStatsCalculator} figure of the same player (parity
 * with the Player page); names are first and last name only, the client formats them.
 */
public record LeaderboardTableDto(
        String group,
        List<LeaderboardColumnInfo> columns,
        LeaderboardSort sort,
        LeaderboardScope scope,
        LeaderboardMinimum minimum,
        LeaderboardBasis basis,
        LeaderboardPageInfo page,
        List<LeaderboardTableRow> rows) {

    /**
     * The column the table is sorted by and the effective direction: HIGHEST (highest value ranks first, request
     * {@code direction=desc}) or LOWEST (lowest first, {@code direction=asc}). Absent request direction echoes the
     * column's natural one.
     */
    public record LeaderboardSort(String code, String direction) {
    }

    /** The filters the figures were computed for ({@code kind} is always {@code CLUB_VERIFIED} in this part). */
    public record LeaderboardScope(String kind, UUID seasonId, UUID leagueId, UUID teamId, UUID sectionId) {
    }

    /**
     * {@code applies}: the sort column is a rate with an optional minimum; {@code value}: the one in force (null = none);
     * {@code suggestedDefault}: the filter-aware default (null when the sort has no minimum); {@code unit}: NONE,
     * INNINGS or OVERS.
     */
    public record LeaderboardMinimum(boolean applies, Integer value, Integer suggestedDefault, String unit) {
    }

    /** How much data the page rests on; {@code coverage} is set only when the sort is built on an optional column. */
    public record LeaderboardBasis(
            long resultsCounted,
            long playersListed,
            long playersRanked,
            long belowMinimum,
            LeaderboardCoverage coverage) {
    }

    /** Innings that recorded the figure ({@code used}) out of innings counted ({@code counted}). */
    public record LeaderboardCoverage(long used, long counted) {
    }

    public record LeaderboardPageInfo(int number, int size, long totalElements, boolean hasMore) {
    }

    /**
     * One player's row. {@code rank} is null for the unranked group (no defined value for a rate sort).
     * {@code teamName} is the player's most frequent counted own-side team in scope. {@code smallSample} is true when the
     * sort is a rate and the sample behind it is under the suggested minimum.
     */
    public record LeaderboardTableRow(
            Integer rank,
            UUID playerId,
            String firstName,
            String lastName,
            boolean active,
            String teamName,
            boolean smallSample,
            Map<String, LeaderboardCell> values) {
    }

    /**
     * One figure. Plain numbers use {@code value}; the highest score uses {@code runs} and {@code notOut}; the best
     * bowling uses {@code wickets} and {@code runs}. All null when the figure is not defined (the client shows a dash).
     * The bowling {@code overs} cell also carries {@code balls} and {@code ballsPerOver} (null when over lengths are
     * mixed) so the client can write it in cricket notation with {@code oversFormat}; they are null on every other cell.
     */
    public record LeaderboardCell(
            BigDecimal value,
            Long runs,
            Long wickets,
            Boolean notOut,
            Long balls,
            Integer ballsPerOver) {
    }
}
