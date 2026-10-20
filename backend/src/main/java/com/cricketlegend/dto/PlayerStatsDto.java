package com.cricketlegend.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * docs/specs/103-player-stats.md: one player's statistics from published results, for the filters echoed in
 * {@link PlayerStatsScope}. Counters are plain numbers; every derived figure is already rounded and is {@code null} when it has no
 * valid denominator (the client shows a dash, never recomputes). Overs are carried as balls plus the over lengths seen:
 * the client renders them with {@code oversFormat}.
 */
public record PlayerStatsDto(
        UUID playerId,
        PlayerStatsScope scope,
        PlayerStatsBasis basis,
        PlayerBatting batting,
        PlayerBowling bowling,
        PlayerFielding fielding,
        PlayerAwards awards,
        PlayerRecord record,
        PlayerForm form,
        List<PlayerNotCaptured> notCaptured) {

    /** The filters the figures were computed for ({@code kind} is always {@code CLUB_VERIFIED} in this part). */
    public record PlayerStatsScope(
            String kind, UUID seasonId, UUID leagueId, UUID teamId, UUID sectionId, String competition) {
    }

    /** How much data the figures rest on. */
    public record PlayerStatsBasis(long matchesCounted, long resultsWithBattingCard, long resultsWithBowlingCard) {
    }

    public record PlayerHighestScore(long runs, boolean notOut) {
    }

    /** One batting position: innings, runs, dismissals and the average (null with no dismissals). */
    public record PlayerBattingPosition(int position, long innings, long runs, long dismissals, BigDecimal average) {
    }

    public record PlayerBattingCoverage(long inningsWithBalls, long inningsWithBoundaries, long inningsCounted) {
    }

    public record PlayerBatting(
            long matches,
            long innings,
            long notOuts,
            long dismissals,
            long runs,
            long ballsFaced,
            long fours,
            long sixes,
            long ducks,
            long goldenDucks,
            long thirtyPlus,
            long fiftyPlus,
            long hundredPlus,
            long centuries,
            long halfCenturies,
            PlayerHighestScore highestScore,
            Map<String, Long> dismissalModes,
            List<PlayerBattingPosition> positions,
            BigDecimal average,
            BigDecimal strikeRate,
            BigDecimal boundaryPercentage,
            BigDecimal ballsPerBoundary,
            PlayerBattingCoverage coverage) {
    }

    public record PlayerBestBowling(long wickets, long runs) {
    }

    public record PlayerBowlingCoverage(
            long inningsWithWides, long inningsWithNoBalls, long inningsWithDots, long inningsCounted) {
    }

    public record PlayerBowling(
            long inningsBowled,
            long ballsBowled,
            List<Integer> ballsPerOver,
            boolean mixedOverLengths,
            long runsConceded,
            long wickets,
            long maidens,
            long wides,
            long noBalls,
            long dots,
            long threeWicketHauls,
            long fourWicketHauls,
            long fiveWicketHauls,
            PlayerBestBowling best,
            Map<String, Long> dismissalModes,
            long dismissalsNotRecorded,
            BigDecimal average,
            BigDecimal economy,
            BigDecimal strikeRate,
            BigDecimal dotBallPercentage,
            PlayerBowlingCoverage coverage) {
    }

    public record PlayerFielding(
            long catches, long stumpings, long runOuts, long dismissals, BigDecimal dismissalsPerMatch) {
    }

    public record PlayerAwards(long playerOfTheMatch, long teamPlayerOfTheMatch) {
    }

    /** The team's result while the player played; {@code internal} counts matches between two of the club's own teams. */
    public record PlayerRecord(long won, long lost, long tied, long drawn, long internal) {
    }

    /** {@code runs}/{@code balls} are null when not recorded; newest first. */
    public record PlayerBattingInnings(UUID matchId, Instant matchDate, Integer runs, boolean notOut, Integer balls) {
    }

    public record PlayerBowlingSpell(
            UUID matchId, Instant matchDate, long wickets, long runs, long balls, int ballsPerOver) {
    }

    public record PlayerForm(List<PlayerBattingInnings> batting, List<PlayerBowlingSpell> bowling) {
    }

    /** A statistic the data does not support yet; {@code tab} is BATTING, BOWLING or FIELDING. */
    public record PlayerNotCaptured(String code, String tab, String label, String reason) {
    }
}
