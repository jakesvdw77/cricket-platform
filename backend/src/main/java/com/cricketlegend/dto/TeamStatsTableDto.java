package com.cricketlegend.dto;

import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardPageInfo;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * docs/specs/116-team-stats.md, "The table (TeamStatsTableDto)": one page of the club's teams table, sorted and ranked
 * by one column, for the filters echoed in {@code scope}. {@code columns} is the fixed column list in display order
 * (the client hard-codes none); every row carries a cell for every column in {@code values}, keyed by {@link
 * TeamStatsColumnInfo#code()}. Every figure is the {@code TeamStatsCalculator} figure of the same team (parity with the
 * team page). Names only the club's own team and section; no person.
 */
public record TeamStatsTableDto(
        List<TeamStatsColumnInfo> columns,
        TeamStatsSort sort,
        TeamStatsScope scope,
        TeamStatsMinimum minimum,
        TeamStatsBasis basis,
        LeaderboardPageInfo page,
        List<TeamStatsTableRow> rows) {

    /**
     * One column. {@code code} is also the {@code sort} request value; {@code label} the short heading and {@code
     * longLabel} the full name; {@code direction} is the natural one, HIGHEST or LOWEST (which end ranks first);
     * {@code minimumKind} is NONE or MATCHES (the optional Minimum matches available when sorting by it); {@code help}
     * is the column's one-line definition.
     */
    public record TeamStatsColumnInfo(
            String code,
            String label,
            String longLabel,
            boolean sortable,
            String direction,
            String minimumKind,
            String help) {
    }

    /** The sort column and the effective direction: HIGHEST (request {@code direction=desc}) or LOWEST ({@code asc}). */
    public record TeamStatsSort(String code, String direction) {
    }

    /** The filters the figures were computed for ({@code kind} is always {@code CLUB_VERIFIED}); {@code competition} is LEAGUE, FRIENDLY or null. */
    public record TeamStatsScope(String kind, UUID seasonId, UUID leagueId, UUID sectionId, String competition) {
    }

    /** {@code applies}: the sort is a rate with an optional minimum; {@code value}: the one in force (null = none); {@code unit}: MATCHES. */
    public record TeamStatsMinimum(boolean applies, Integer value, String unit) {
    }

    /**
     * How much data the table rests on. {@code resultsCounted}: distinct published results with a counted team result;
     * {@code internalResults}: derbies among them (each counts once for each of its two teams);
     * {@code resultsNoBallBowled}: NO_RESULT or ABANDONED with no ball bowled (not counted); {@code forfeits}: forfeited
     * results (counted in the record, no innings); {@code teamsListed}, {@code teamsRanked}, {@code belowMinimum}: the table.
     */
    public record TeamStatsBasis(
            long resultsCounted,
            long internalResults,
            long resultsNoBallBowled,
            long forfeits,
            long teamsListed,
            long teamsRanked,
            long belowMinimum) {
    }

    /** One team's row. {@code rank} is null for the unranked group (no defined value for the sort). */
    public record TeamStatsTableRow(
            Integer rank,
            UUID teamId,
            String teamName,
            String sectionName,
            boolean active,
            Map<String, TeamStatsCell> values) {
    }

    /**
     * One figure. Plain numbers use {@code value}; the highest total also carries {@code runs} and {@code wickets}
     * ({@code value} = runs); net run rate (signed, 2 decimals) carries {@code status} (SHOWN, NOT_ONE_COMPETITION or NO_USABLE_RESULTS),
     * {@code rule} (FULL_QUOTA), {@code matchesUsed} and {@code matchesCounted}. All null when the figure is not defined
     * (the client shows a dash); status, rule and the match counts are null on every other cell.
     */
    public record TeamStatsCell(
            BigDecimal value,
            Long runs,
            Long wickets,
            String status,
            String rule,
            Long matchesUsed,
            Long matchesCounted) {
    }
}
