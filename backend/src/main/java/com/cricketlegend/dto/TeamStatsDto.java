package com.cricketlegend.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/116-team-stats.md, "The team page (TeamStatsDto)": one club team's full statistics for the filters echoed in
 * {@code scope}. Every figure is the {@code TeamStatsCalculator} figure the teams table shows in the same team's cell for
 * the same filters (parity). A figure with no valid denominator is null (the client shows a dash), never 0. Names only the
 * club's own team and the opponents' names (clubs or free text); no person.
 *
 * <p>A team with no counted result is a normal read: zero counters, {@code basis.resultsCounted} 0, null rates.
 */
public record TeamStatsDto(
        UUID teamId,
        String teamName,
        UUID sectionId,
        boolean active,
        TeamStatsPageScope scope,
        TeamStatsPageBasis basis,
        TeamStatsRecord record,
        List<TeamStatsFormEntry> form,
        TeamStatsBatting batting,
        TeamStatsChasing chasing,
        TeamStatsBowling bowling,
        TeamStatsExtras extras,
        TeamStatsNetRunRate netRunRate,
        List<TeamStatsNotCaptured> notCaptured) {

    /** The filters the figures were computed for ({@code kind} is always CLUB_VERIFIED); {@code competition} is LEAGUE, FRIENDLY or null. */
    public record TeamStatsPageScope(String kind, UUID seasonId, UUID leagueId, String competition) {
    }

    /**
     * What was counted and what was left out. {@code resultsCounted}: counted team results of this team (forfeits
     * included); {@code internalResults}: derbies among them; {@code resultsNoBallBowled}: NO_RESULT or ABANDONED left out
     * for want of a ball; {@code resultsWithBothInnings}: counted results with a usable innings on each side.
     */
    public record TeamStatsPageBasis(
            long resultsCounted,
            long internalResults,
            long resultsNoBallBowled,
            TeamStatsForfeits forfeits,
            long resultsWithBothInnings) {
    }

    /** Counted forfeits: {@code received} is a win for this team, {@code conceded} a loss. */
    public record TeamStatsForfeits(long received, long conceded) {
    }

    /** {@code played} = won + lost + tied + drawn + noResult (forfeits are in won and lost); {@code decisive} = won + lost; {@code winPercent} has 1 decimal. */
    public record TeamStatsRecord(
            long played,
            long won,
            long lost,
            long tied,
            long drawn,
            long noResult,
            long decisive,
            BigDecimal winPercent) {
    }

    /**
     * One of the last five counted results, newest first. {@code result} is WON, LOST, TIED, DRAWN or NO_RESULT;
     * {@code forfeit} marks a forfeit win or loss (no scores); {@code derby} marks an internal match (the opponent is the
     * other club team). {@code opponentName} is the opposite side's team name, else its free-text name (null when neither).
     */
    public record TeamStatsFormEntry(
            UUID matchId,
            UUID resultId,
            Instant matchDate,
            String opponentName,
            boolean derby,
            String result,
            boolean forfeit) {
    }

    /** A highest or lowest total with the match it was scored in. */
    public record TeamStatsInningsTotal(
            long runs, long wickets, boolean allOut, UUID matchId, Instant matchDate, String opponentName) {
    }

    /** {@code inningsUsable}/{@code inningsCounted}: usable and all own innings; {@code inningsClassifiable}: innings whose completeness is known (lowest total). */
    public record TeamStatsBattingCoverage(long inningsUsable, long inningsCounted, long inningsClassifiable) {
    }

    public record TeamStatsBatting(
            Long runs,
            Long wicketsLost,
            long innings,
            BigDecimal runsPerInnings,
            BigDecimal battingAverage,
            BigDecimal runRate,
            Long ballsFaced,
            TeamStatsInningsTotal highestTotal,
            TeamStatsInningsTotal lowestTotal,
            TeamStatsBattingCoverage coverage) {
    }

    public record TeamStatsChasing(
            TeamStatsChase highestSuccessfulChase,
            TeamStatsVictoryByRuns largestVictoryByRuns,
            TeamStatsVictoryByWickets largestVictoryByWickets) {
    }

    /** {@code runs}: the score the team reached; {@code target}: the opposition runs plus one; {@code wickets}: lost in the chase. */
    public record TeamStatsChase(
            long runs, long target, long wickets, UUID matchId, Instant matchDate, String opponentName) {
    }

    public record TeamStatsVictoryByRuns(long margin, UUID matchId, Instant matchDate, String opponentName) {
    }

    /** {@code ballsRemaining} is null when the chase innings or the scheduled quota is unknown. */
    public record TeamStatsVictoryByWickets(
            long margin, Long ballsRemaining, UUID matchId, Instant matchDate, String opponentName) {
    }

    public record TeamStatsBowlingCoverage(long inningsUsable, long inningsCounted) {
    }

    public record TeamStatsBowling(
            Long wicketsTaken,
            Long runsConceded,
            Long ballsBowled,
            BigDecimal bowlingAverage,
            BigDecimal economy,
            TeamStatsBowlingCoverage coverage) {
    }

    /** {@code inningsRecorded} of {@code inningsCounted} opposition innings recorded the figure (summary-level results leave it blank). */
    public record TeamStatsExtrasCoverage(long inningsRecorded, long inningsCounted) {
    }

    /** {@code inningsWithExtras} of {@code inningsCounted} opposition innings recorded an extras total. */
    public record TeamStatsExtrasTotalCoverage(long inningsWithExtras, long inningsCounted) {
    }

    /** The coverage of each component of the extras breakdown. */
    public record TeamStatsExtrasComponentCoverage(
            TeamStatsExtrasCoverage wides,
            TeamStatsExtrasCoverage noBalls,
            TeamStatsExtrasCoverage byes,
            TeamStatsExtrasCoverage legByes,
            TeamStatsExtrasCoverage penaltyRuns) {
    }

    /**
     * Extras conceded (the opposition's innings extras). Every figure is null when no innings recorded it; {@code
     * coverage} is for {@code conceded} and {@code averagePerMatch} (innings with extras recorded), {@code
     * componentCoverage} for each component.
     */
    public record TeamStatsExtras(
            Long conceded,
            BigDecimal averagePerMatch,
            Long wides,
            Long noBalls,
            Long byes,
            Long legByes,
            Long penaltyRuns,
            TeamStatsExtrasTotalCoverage coverage,
            TeamStatsExtrasComponentCoverage componentCoverage) {
    }

    /** {@code status}: SHOWN, NOT_ONE_COMPETITION or NO_USABLE_RESULTS; {@code value} (signed, 2 decimals) only when SHOWN; {@code rule}: FULL_QUOTA; {@code matchesUsed} of {@code matchesCounted} results fed it. */
    public record TeamStatsNetRunRate(
            String status,
            BigDecimal value,
            String rule,
            long matchesUsed,
            long matchesCounted,
            UUID leagueId,
            UUID seasonId) {
    }

    /** A statistic the data does not support yet (today: partnerships). */
    public record TeamStatsNotCaptured(String code, String label, String reason) {
    }
}
