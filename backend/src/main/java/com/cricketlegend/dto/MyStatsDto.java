package com.cricketlegend.dto;

import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardBattingSummary;
import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardEconomySummary;
import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardWicketTypes;
import com.cricketlegend.dto.PlayerStatsDto.PlayerAwards;
import com.cricketlegend.dto.PlayerStatsDto.PlayerBatting;
import com.cricketlegend.dto.PlayerStatsDto.PlayerBowling;
import com.cricketlegend.dto.PlayerStatsDto.PlayerFielding;
import com.cricketlegend.dto.PlayerStatsDto.PlayerForm;
import com.cricketlegend.dto.PlayerStatsDto.PlayerNotCaptured;
import com.cricketlegend.dto.PlayerStatsDto.PlayerRecord;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/147 "MyStatsDto": the one payload of the Player Hub "My stats" page, for a player the caller holds, in the
 * Player Hub scope (only published results a manager switched on). Every figure is decided by {@code
 * PlayerStatsCalculator} (and {@code PlayerDashboardSeriesBuilder}, which calls it); the client only draws. The JSON keys
 * are exactly the component names below. A figure with no valid denominator or an unrecorded value is {@code null} (a
 * gap), never 0. The DTO carries no internal id other than {@code matchId} and the scope ids: no profile id, result id or
 * row id. Names other than the subject's own first name: opponent names and bowler names as the manager recorded them, and
 * the full names of the subject's teammates in {@code wicketsByPosition.caughtBy} (shown only inside the signed-in Hub).
 *
 * <p>{@code basis.truncated}: the player has more than {@code basis.historyCap} counted matches in scope, so every block
 * that is built from the per-match history (series, rolling, bands, byInningsNumber, byOpposition, dismissedBy,
 * wicketsByPosition, milestones.personalBests, teamRecordWhenScoring, homeAway, bowlingDiscipline.byInnings and
 * basis.resultsWithFieldingCard) covers the newest {@code historyCap} matches only; the counter blocks (batting, bowling,
 * fielding, awards, record, bySeason, milestones progress) always cover the whole scope.
 *
 * <p>Drill tokens: every {@code filter} string in this payload is a value the drill read {@code GET
 * .../stats/innings?kind=&filter=} accepts for the kind named beside it (see {@code StatsDrillFilter}); the client builds
 * no filter of its own.
 *
 * <p>{@code teamFielding} (spec 147 slice 4) is the catches, run-outs and stumpings credited to the linked players in the
 * games of the player's own team(s) in the scope (null when the player has no team in the scope; a guest's or an unlinked
 * player's credits are not counted). {@code teamFieldingRank} (the player's rank for catches within those teams, null
 * without a catch) and {@code standing} (the player's batting-average rank among the batters of the league, only when a
 * league is chosen, under the default minimum innings) are rankings: they are {@code null} unless {@code HubRankingPolicy}
 * allows rankings.
 */
public record MyStatsDto(
        MyStatsScope scope,
        String playerFirstName,
        String ageBand,
        MyStatsBasis basis,
        PlayerBatting batting,
        PlayerBowling bowling,
        PlayerFielding fielding,
        PlayerAwards awards,
        PlayerRecord record,
        PlayerForm form,
        MyStatsSeries series,
        MyStatsRolling rolling,
        MyStatsGuides guides,
        List<MyStatsBand> bands,
        MyStatsByInningsNumber byInningsNumber,
        List<MyStatsOpposition> byOpposition,
        MyStatsDismissedBy dismissedBy,
        MyStatsWicketsByPosition wicketsByPosition,
        MyStatsMilestones milestones,
        MyStatsTeamRecordWhenScoring teamRecordWhenScoring,
        MyStatsHomeAway homeAway,
        List<MyStatsSeason> bySeason,
        MyStatsBowlingDiscipline bowlingDiscipline,
        MyStatsAvailability availability,
        MyStatsTeamFielding teamFielding,
        Integer teamFieldingRank,
        MyStatsStanding standing,
        List<PlayerNotCaptured> notCaptured) {

    /** The filters applied, echoed. {@code competition} is LEAGUE, FRIENDLY or null. */
    public record MyStatsScope(UUID seasonId, UUID leagueId, UUID teamId, String competition) {
    }

    /**
     * "Based on N of M results": {@code resultsCounted} is M; the three card counts are how many of them have a captured
     * batting, bowling and fielding card. {@code fixturesRemaining}: upcoming active matches of the player's teams in the
     * chosen season (null when no season is chosen). {@code historyCap}: see the class note.
     */
    public record MyStatsBasis(
            long resultsCounted,
            long resultsWithBattingCard,
            long resultsWithBowlingCard,
            long resultsWithFieldingCard,
            Long fixturesRemaining,
            boolean truncated,
            int historyCap) {
    }

    // ---- series (docs/specs/117 shapes, without the internal ids) ----

    /**
     * The player Dashboard series for the Hub: {@code battingInnings}, {@code battingTrend} and {@code bowlingMatches} are
     * the last {@code window.pointLimit} points, oldest first. {@code dismissals} carry the drill token beside each slice.
     */
    public record MyStatsSeries(
            DashboardWindowDto window,
            List<MyStatsSeriesInnings> battingInnings,
            PlayerDashboardBattingSummary battingSummary,
            List<MyStatsDismissal> dismissals,
            List<MyStatsTrendPoint> battingTrend,
            List<MyStatsBowlingMatch> bowlingMatches,
            PlayerDashboardWicketTypes wicketTypes,
            PlayerDashboardEconomySummary economySummary) {
    }

    /** One batted innings. {@code balls} is null when not valid; {@code howOut} is the stored dismissal type name. */
    public record MyStatsSeriesInnings(
            UUID matchId,
            Instant matchDate,
            String opponentName,
            boolean derby,
            Integer runs,
            Integer balls,
            boolean notOut,
            String howOut) {
    }

    /** One slice of "How the player gets out"; {@code filter} is the BATTING drill token of the slice. */
    public record MyStatsDismissal(String type, String label, long count, BigDecimal percent, String filter) {
    }

    /** Running totals after one batted innings; {@code average} is null until the first dismissal. */
    public record MyStatsTrendPoint(
            UUID matchId,
            Instant matchDate,
            String opponentName,
            boolean derby,
            long cumulativeRuns,
            long cumulativeDismissals,
            BigDecimal average) {
    }

    /** One counted match in which the player bowled; {@code economy} is null at zero balls. */
    public record MyStatsBowlingMatch(
            UUID matchId,
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

    // ---- rolling, guides, bands ----

    /**
     * The rolling average of the last {@code span} innings (runs divided by dismissals within that window; null while the
     * window holds no dismissal), per batted innings, oldest first, the last {@code window.pointLimit} points. {@code hint}
     * pools the last {@code span} innings against the {@code span} before (null when either half is too small).
     */
    public record MyStatsRolling(int span, List<MyStatsRollingPoint> points, MyStatsTrendHint hint) {
    }

    public record MyStatsRollingPoint(UUID matchId, Instant matchDate, BigDecimal average) {
    }

    /** {@code direction} is UP, DOWN or FLAT. */
    public record MyStatsTrendHint(BigDecimal recent, BigDecimal earlier, String direction) {
    }

    /**
     * The graph guide lines of the innings graph for the player's age band ({@code basis} is the age band name). Reference
     * lines only: they never change a counted figure.
     */
    public record MyStatsGuides(int low, int high, String basis) {
    }

    /** Scores in one band; {@code key} is 0-9, 10-29, 30-49 or 50+; {@code percent} (1 decimal) is of all banded innings. */
    public record MyStatsBand(String key, String label, long innings, BigDecimal percent, String filter) {
    }

    // ---- splits ----

    public record MyStatsByInningsNumber(MyStatsInningsSplit battingFirst, MyStatsInningsSplit chasing) {
    }

    /** Batting in the first or second innings of a match; {@code filter} is the BATTING drill token. */
    public record MyStatsInningsSplit(long innings, long notOuts, long runs, BigDecimal average, String filter) {
    }

    /** One opponent name as recorded (case-insensitive grouping); {@code scores} are in date order. */
    public record MyStatsOpposition(String opponentName, long innings, long runs, BigDecimal average, List<MyStatsScore> scores) {
    }

    public record MyStatsScore(UUID matchId, Instant matchDate, Integer runs, boolean notOut) {
    }

    // ---- how the player gets out, how the player takes wickets ----

    /**
     * Bowlers who dismissed the player, most first. {@code notRecorded}: bowler-credited dismissals with no bowler named;
     * {@code total}: all bowler-credited dismissals (the sum of the bowler counts and {@code notRecorded}).
     */
    public record MyStatsDismissedBy(List<MyStatsNameCount> bowlers, long notRecorded, long total) {
    }

    /** A name as the manager recorded it (full name for a teammate) and a count. */
    public record MyStatsNameCount(String name, long count) {
    }

    /**
     * The batters the player dismissed (bowler-credited types) by batting position: groups OPENERS (1 to 2), MIDDLE (3 to
     * 6) and TAIL (7 to 11), then {@code notRecorded} (no or out-of-range position). {@code caughtBy}: the player's own
     * fielders on caught dismissals, most first.
     */
    public record MyStatsWicketsByPosition(
            List<MyStatsPositionGroup> groups, long notRecorded, long total, List<MyStatsNameCount> caughtBy) {
    }

    public record MyStatsPositionGroup(String key, String label, long count) {
    }

    // ---- milestones ----

    public record MyStatsMilestones(
            MyStatsMilestone runs, MyStatsMilestone wickets, MyStatsMilestone catches, MyStatsPersonalBests personalBests) {
    }

    /** Progress to the next round number: {@code toGo = target - current}. */
    public record MyStatsMilestone(long current, long target, long toGo) {
    }

    /**
     * Personal bests, each with the match it came from (null when the scope has none). {@code bestStrikeRate} only
     * considers innings with at least {@code minimumBalls} valid balls.
     */
    public record MyStatsPersonalBests(
            MyStatsBestInnings highestScore,
            MyStatsBestBowling bestBowling,
            MyStatsBestCatches mostCatches,
            MyStatsBestStrikeRate bestStrikeRate,
            int minimumBalls) {
    }

    public record MyStatsBestInnings(long runs, boolean notOut, UUID matchId) {
    }

    public record MyStatsBestBowling(long wickets, long runs, UUID matchId) {
    }

    public record MyStatsBestCatches(long catches, UUID matchId) {
    }

    public record MyStatsBestStrikeRate(BigDecimal strikeRate, long runs, long balls, UUID matchId) {
    }

    // ---- team record, home and away, seasons ----

    /**
     * The team's record in counted matches in which the player scored {@code threshold} or more in an innings
     * ({@code scored}) and in the other counted matches with a captured batting card ({@code notScored}); a derby is left
     * out. {@code scoredFilter} and {@code notScoredFilter} are MATCHES drill tokens.
     */
    public record MyStatsTeamRecordWhenScoring(
            int threshold,
            MyStatsRecordSplit scored,
            MyStatsRecordSplit notScored,
            String scoredFilter,
            String notScoredFilter) {
    }

    /** {@code winPercent} (1 decimal) is won of won, lost, tied and drawn. */
    public record MyStatsRecordSplit(long matches, long won, long lost, long tied, long drawn, BigDecimal winPercent) {
    }

    /**
     * Batting at the club's own home fields versus elsewhere. {@code unknownFieldMatches}: matches with a batted innings
     * but no playing area recorded (left out of both splits).
     */
    public record MyStatsHomeAway(MyStatsFieldSplit home, MyStatsFieldSplit away, long unknownFieldMatches) {
    }

    public record MyStatsFieldSplit(long innings, long dismissals, long runs, BigDecimal average) {
    }

    /** One season, oldest first (the Season filter is ignored for this block, every other filter applies). */
    public record MyStatsSeason(
            UUID seasonId, String label, long matches, long innings, long runs, BigDecimal average, long wickets) {
    }

    // ---- bowling discipline ----

    /**
     * Wides and no-balls charged to the bowler (byes and leg byes are never charged to a bowler). Totals are the stored
     * counters of the whole scope; {@code widesPerOver} and {@code noBallsPerOver} use only the spells that recorded the
     * figure. {@code inningsRecorded} of {@code inningsCounted} spells recorded both.
     */
    public record MyStatsBowlingDiscipline(
            long wides,
            long noBalls,
            BigDecimal widesPerOver,
            BigDecimal noBallsPerOver,
            long inningsRecorded,
            long inningsCounted,
            List<MyStatsDisciplineSpell> byInnings) {
    }

    /** One spell, oldest first. {@code wides} and {@code noBalls} are null when not recorded. */
    public record MyStatsDisciplineSpell(
            UUID matchId,
            Instant matchDate,
            String opponentName,
            long balls,
            int ballsPerOver,
            Integer wides,
            Integer noBalls) {
    }

    // ---- availability and the team ----

    /**
     * "Always there": closed polls the player was asked ({@code pollsTotal}), those answered, those answered "available",
     * the started matches the player was selected for and the counted matches played, all in the chosen scope.
     */
    public record MyStatsAvailability(
            long pollsTotal, long pollsAnswered, long answeredAvailable, long matchesSelected, long matchesPlayed) {
    }

    /** The player's team(s) fielding totals for the scope (see the class note). */
    public record MyStatsTeamFielding(long catches, long runOuts, long stumpings) {
    }

    /**
     * The player's rank by batting average among the league's batters ({@code rank} is null while the player is below the
     * minimum innings or has no average yet), out of {@code playersRanked}; {@code average} and {@code innings} are the
     * player's own in that league.
     */
    public record MyStatsStanding(Integer rank, Long playersRanked, BigDecimal average, Long innings) {
    }
}
