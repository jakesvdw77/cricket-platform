package com.cricketlegend.dto;

import com.cricketlegend.dto.TeamStatsDto.TeamStatsNotCaptured;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsPageBasis;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsPageScope;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/117-stats-dashboard.md, "Team series": every series of the team Dashboard for the filters echoed in {@code
 * scope}, in one response. Every plotted number is decided by {@code TeamDashboardSeriesBuilder} through {@code
 * TeamStatsCalculator}; the client only draws. Series are chronological (oldest first). An unrecorded or unusable figure is
 * {@code null} (a gap), never 0. Names only the club's own team and opponents' names; no person.
 *
 * <p>{@code truncated}: the scope held more than {@code window.historyCap} counted results, so the series cover the newest
 * {@code historyCap} only and {@code truncatedSince} is the date of the oldest result included. A team with no counted
 * result is a normal read: empty series and zero counts.
 */
public record TeamDashboardDto(
        UUID teamId,
        String teamName,
        TeamStatsPageScope scope,
        TeamStatsPageBasis basis,
        DashboardWindowDto window,
        boolean truncated,
        Instant truncatedSince,
        List<TeamDashboardResult> results,
        TeamDashboardResultsSummary resultsSummary,
        List<TeamDashboardRunRatePoint> runRateTrend,
        TeamDashboardNetRunRateTrend netRunRateTrend,
        List<TeamDashboardExtrasPoint> extrasConceded,
        TeamDashboardExtrasSummary extrasSummary,
        List<TeamDashboardDotBallsPoint> dotBalls,
        TeamDashboardDotBallsSummary dotBallsSummary,
        List<TeamStatsNotCaptured> notCaptured) {

    /**
     * One counted team result (the last {@code window.pointLimit}). {@code result} is WON, LOST, TIED, DRAWN or NO_RESULT;
     * {@code forfeit} marks a win or loss by forfeit (no innings: every run, wicket, ball and rate is null). A result whose
     * innings is not usable has null figures too. Rates have 2 decimals, null when the innings has no balls.
     */
    public record TeamDashboardResult(
            UUID matchId,
            UUID resultId,
            Instant matchDate,
            String opponentName,
            boolean derby,
            boolean forfeit,
            String result,
            Long ownRuns,
            Long ownWickets,
            Long ownBalls,
            Long oppRuns,
            Long oppWickets,
            Long oppBalls,
            BigDecimal ownRunRate,
            BigDecimal oppRunRate) {
    }

    /**
     * The Results donut (every counted result in the covered history; a forfeit is a win or a loss, as the record counts
     * it): {@code played} = won + lost + tied + drawn + noResult. {@code totalPoints} results exist in the history, {@code
     * shown} are in {@code results}, {@code withRuns} of those have usable runs on both sides. Each {@code *Percent} is
     * that count over {@code played}, one decimal HALF_UP, null when nothing was played.
     */
    public record TeamDashboardResultsSummary(
            long played,
            long won,
            long lost,
            long tied,
            long drawn,
            long noResult,
            long forfeits,
            long totalPoints,
            long shown,
            long withRuns,
            BigDecimal wonPercent,
            BigDecimal lostPercent,
            BigDecimal tiedPercent,
            BigDecimal drawnPercent,
            BigDecimal noResultPercent) {
    }

    /**
     * Running team and opposition run rates (runs per over, 2 decimals) after each counted result with a usable innings and
     * balls on that side, over the covered history; the last point equals the page's Team run rate and Team economy.
     */
    public record TeamDashboardRunRatePoint(
            UUID matchId,
            UUID resultId,
            Instant matchDate,
            String opponentName,
            BigDecimal teamRunRate,
            BigDecimal oppositionRunRate) {
    }

    /** {@code status}: SHOWN, NOT_ONE_COMPETITION or NO_USABLE_RESULTS (116); {@code points} only when SHOWN. */
    public record TeamDashboardNetRunRateTrend(String status, List<TeamDashboardNetRunRatePoint> points) {
    }

    /** The running net run rate (signed, 2 decimals) after one net-run-rate-usable result. */
    public record TeamDashboardNetRunRatePoint(
            UUID matchId, UUID resultId, Instant matchDate, String opponentName, BigDecimal value) {
    }

    /**
     * Extras conceded in one counted result's opposition innings (the last {@code window.pointLimit}). Components are null
     * when not recorded; {@code itemised} is true when any is recorded; {@code notItemised} is the stored total of a
     * total-only innings (no component), else null; {@code total} is the stored extras, null when none were recorded (a gap).
     */
    public record TeamDashboardExtrasPoint(
            UUID matchId,
            UUID resultId,
            Instant matchDate,
            String opponentName,
            boolean derby,
            Integer wides,
            Integer noBalls,
            Integer byes,
            Integer legByes,
            Integer penaltyRuns,
            boolean itemised,
            Integer notItemised,
            Integer total) {
    }

    /**
     * Coverage of the Extras conceded card: {@code matchesCounted} (our bowling innings in the window), {@code
     * matchesWithExtras} (total recorded), {@code matchesItemised}, {@code totalPoints} (in the covered history), {@code
     * shown} (the window), and the number of windowed innings that recorded each component.
     */
    public record TeamDashboardExtrasSummary(
            long matchesCounted,
            long matchesWithExtras,
            long matchesItemised,
            long totalPoints,
            long shown,
            long widesRecorded,
            long noBallsRecorded,
            long byesRecorded,
            long legByesRecorded,
            long penaltyRunsRecorded) {
    }

    /**
     * Dot balls in one counted result's opposition innings (the last {@code window.pointLimit}). {@code ballsBowled} is the
     * sum of our bowler rows' balls (null without bowler rows); {@code dots} is set only when every bowler row that bowled
     * a ball recorded dots; {@code dotPercent} (1 decimal) is null otherwise.
     */
    public record TeamDashboardDotBallsPoint(
            UUID matchId,
            UUID resultId,
            Instant matchDate,
            String opponentName,
            boolean derby,
            Integer ballsBowled,
            Integer dots,
            BigDecimal dotPercent) {
    }

    /**
     * Coverage and reference for the Dot balls card, over the windowed matches: {@code averageDotPercent} is the pooled
     * figure (Σ dots / Σ balls of the charted matches, 1 decimal); the trend fields (last five charted matches against the
     * five before, pooled; {@code direction} UP, DOWN or FLAT within 0.5 points) are null unless each half has at least
     * three.
     */
    public record TeamDashboardDotBallsSummary(
            long matchesCounted,
            long matchesWithDots,
            long totalPoints,
            long shown,
            BigDecimal averageDotPercent,
            BigDecimal recentAverage,
            BigDecimal earlierAverage,
            String direction) {
    }
}
