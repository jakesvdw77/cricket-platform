package com.cricketlegend.dto;

import com.cricketlegend.dto.PlayerStatsDto.PlayerNotCaptured;
import com.cricketlegend.dto.PlayerStatsDto.PlayerStatsBasis;
import com.cricketlegend.dto.PlayerStatsDto.PlayerStatsScope;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/117-stats-dashboard.md, "Player series": every series of the player Dashboard for the filters echoed in
 * {@code scope}, in one response. Every plotted number is decided by {@code PlayerDashboardSeriesBuilder} through {@code
 * PlayerStatsCalculator}; the client only draws. Series are chronological (oldest first). A figure with no valid
 * denominator, a missing scorecard or an unrecorded value is {@code null} (a gap), never 0. The DTO carries no access
 * information and names no person other than the subject (opponents are club or free-text names; null in a derby).
 *
 * <p>{@code truncated}: the scope held more than {@code window.historyCap} counted matches, so the series cover the newest
 * {@code historyCap} only and {@code truncatedSince} is the date of the oldest match included; parity with the tiles holds
 * for untruncated scopes. {@code economySummary.overallEconomy} and {@code battingSummary.averageRuns} are always over the
 * whole filtered scope.
 */
public record PlayerDashboardDto(
        UUID playerId,
        PlayerStatsScope scope,
        PlayerStatsBasis basis,
        DashboardWindowDto window,
        boolean truncated,
        Instant truncatedSince,
        List<PlayerDashboardBattingInnings> battingInnings,
        PlayerDashboardBattingSummary battingSummary,
        List<PlayerDashboardDismissal> dismissals,
        List<PlayerDashboardTrendPoint> battingTrend,
        List<PlayerDashboardBowlingMatch> bowlingMatches,
        PlayerDashboardWicketTypes wicketTypes,
        PlayerDashboardEconomySummary economySummary,
        List<PlayerNotCaptured> notCaptured) {

    /**
     * One batted innings (the last {@code window.pointLimit}). {@code runs} is null only if a row stored none; {@code balls} is null when not valid (spec 103); {@code
     * howOut} is the stored dismissal type name; {@code opponentName} is null in a derby ({@code derby} true).
     */
    public record PlayerDashboardBattingInnings(
            UUID matchId,
            UUID resultId,
            Instant matchDate,
            String opponentName,
            boolean derby,
            Integer runs,
            Integer balls,
            boolean notOut,
            String howOut) {
    }

    /**
     * The Runs per innings card's figures. {@code inningsTotal}: every batted innings in the covered matches ({@code
     * shown} of them are in {@code battingInnings}); {@code runs}: their runs; {@code averageRuns}: the batting average
     * (runs per dismissal) over the whole filtered scope, null with no dismissal (the optional reference line).
     */
    public record PlayerDashboardBattingSummary(
            long inningsTotal, long shown, long notOuts, long runs, BigDecimal averageRuns) {
    }

    /**
     * One slice of "How you were dismissed": {@code type} is a stored dismissal type name, with {@code NOT_OUT} for both
     * not-out kinds; only types with a count are returned, in a fixed order, the not-out slice first. {@code percent} (1
     * decimal) is of all batted innings.
     */
    public record PlayerDashboardDismissal(String type, String label, long count, BigDecimal percent) {
    }

    /**
     * Running totals after one batted innings, over every counted innings. {@code average} is null until the first
     * dismissal (not-outs raise runs without the denominator).
     */
    public record PlayerDashboardTrendPoint(
            UUID matchId,
            UUID resultId,
            Instant matchDate,
            String opponentName,
            boolean derby,
            long cumulativeRuns,
            long cumulativeDismissals,
            BigDecimal average) {
    }

    /**
     * One counted match in which the player bowled (the last {@code window.pointLimit}); both sides' rows are summed in a
     * derby. {@code economy} (2 decimals) is null at zero balls.
     */
    public record PlayerDashboardBowlingMatch(
            UUID matchId,
            UUID resultId,
            Instant matchDate,
            String opponentName,
            boolean derby,
            long balls,
            int ballsPerOver,
            long maidens,
            long runs,
            long wickets,
            BigDecimal economy) {
    }

    /** One bowler-credited dismissal type of the Wickets by type donut; {@code percent} (1 decimal) is null at total 0. */
    public record PlayerDashboardWicketType(String type, String label, long count, BigDecimal percent) {
    }

    public record PlayerDashboardNotItemised(long count, BigDecimal percent) {
    }

    /** {@code wicketsItemised} of {@code wicketsTotal} wickets, {@code inningsItemised} of {@code inningsWithWickets} innings. */
    public record PlayerDashboardWicketCoverage(
            long wicketsItemised, long wicketsTotal, long inningsItemised, long inningsWithWickets) {
    }

    /**
     * The player's own wickets by dismissal type: all six types in a fixed order (bowled, caught, caught and bowled, lbw,
     * stumped, hit wicket); {@code types} plus {@code notItemised} always add up to {@code total} (the Wickets tile).
     * {@code itemised} is the sum of the types.
     */
    public record PlayerDashboardWicketTypes(
            List<PlayerDashboardWicketType> types,
            PlayerDashboardNotItemised notItemised,
            long total,
            long itemised,
            PlayerDashboardWicketCoverage coverage) {
    }

    /**
     * The Economy rate card. {@code overallEconomy}: Σ runs / Σ overs over the whole filtered scope (the Bowling tab's Econ,
     * the dashed reference line). {@code matchesCounted}: matches in {@code bowlingMatches} (the window); {@code
     * matchesWithEconomy}: those with a defined economy; {@code totalPoints}: every counted match in which the player
     * bowled; {@code shown}: the window size. The trend fields (pooled economy of the last five matches with economy against
     * the five before, {@code direction} UP, DOWN or FLAT within 0.25) are null unless each half has at least three.
     */
    public record PlayerDashboardEconomySummary(
            BigDecimal overallEconomy,
            long matchesCounted,
            long matchesWithEconomy,
            long totalPoints,
            long shown,
            BigDecimal recentEconomy,
            BigDecimal earlierEconomy,
            String direction) {
    }
}
