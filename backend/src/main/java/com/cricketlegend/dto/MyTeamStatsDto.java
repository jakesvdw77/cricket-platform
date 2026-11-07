package com.cricketlegend.dto;

import com.cricketlegend.dto.TeamDashboardDto.TeamDashboardDotBallsSummary;
import com.cricketlegend.dto.TeamDashboardDto.TeamDashboardExtrasSummary;
import com.cricketlegend.dto.TeamDashboardDto.TeamDashboardResultsSummary;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsBatting;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsBowling;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsChasing;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsExtras;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsForfeits;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsNetRunRate;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsNotCaptured;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsRecord;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/147 "MyTeamStatsDto": the one payload of the Player Hub "Team stats" page, for one team of a player the caller
 * holds, in the Player Hub scope (only published results a manager switched on). It is {@link TeamStatsDto}'s content (the
 * same {@code TeamStatsCalculator} figures the manager page shows for the same scope) plus the {@link TeamDashboardDto}
 * series plus the Hub blocks below; every figure is decided by {@code TeamStatsCalculator}, the client only draws. The JSON
 * keys are exactly the component names. A figure with no valid denominator or an unrecorded value is {@code null} (a gap),
 * never 0. The DTO carries no internal id other than {@code matchId} and the scope ids: no result id, profile id or section
 * id. Names: the team's own name, opponent names as the manager recorded them (free text) and, inside {@code
 * contribution}, the full names of the team's players (guests grouped as "Guests"), shown only inside the signed-in Hub.
 *
 * <p>{@code basis.truncated}: the team has more than {@code basis.historyCap} counted results in scope, so every block built
 * from the result history (series, battingOrder, tossWon, headToHead, squad, closeGames) covers the newest {@code
 * historyCap} results only; the counter blocks (record, batting, chasing, bowling, extras, netRunRate, contribution,
 * extrasCard) always cover the whole scope. {@code chasing} is the manager page's block (highest chase and largest
 * victories); the batting-first and chasing split is {@code battingOrder}.
 */
public record MyTeamStatsDto(
        MyTeamScope scope,
        String teamName,
        MyTeamBasis basis,
        TeamStatsRecord record,
        List<MyTeamFormEntry> form,
        TeamStatsBatting batting,
        TeamStatsChasing chasing,
        TeamStatsBowling bowling,
        TeamStatsExtras extras,
        TeamStatsNetRunRate netRunRate,
        MyTeamSeries series,
        MyTeamContribution contribution,
        MyTeamBattingOrder battingOrder,
        MyTeamToss tossWon,
        List<MyTeamHeadToHead> headToHead,
        MyTeamSquad squad,
        MyTeamCloseGames closeGames,
        MyTeamExtrasCard extrasCard,
        List<TeamStatsNotCaptured> notCaptured,
        MyTeamDismissals dismissals,
        List<MyTeamPositionGroup> battingPositionGroups,
        MyTeamBoundaries boundaries,
        List<MyTeamVenue> venues,
        MyTeamWicketTypes wicketTypes,
        MyTeamFielding fielding,
        MyTeamInningsSplit byInningsNumber) {

    /** The filters echoed; {@code competition} is LEAGUE, FRIENDLY or null. */
    public record MyTeamScope(UUID seasonId, UUID leagueId, UUID teamId, String competition) {
    }

    /**
     * What was counted ({@code resultsCounted} is "M" of "Based on N of M results") and, per block, how many of the counted
     * results (or innings) recorded what the block needs.
     */
    public record MyTeamBasis(
            long resultsCounted,
            long internalResults,
            long resultsNoBallBowled,
            TeamStatsForfeits forfeits,
            long resultsWithBothInnings,
            boolean truncated,
            int historyCap,
            MyTeamCoverage coverage) {
    }

    /** {@code recorded} of {@code counted} for one block. */
    public record MyTeamCount(long recorded, long counted) {
    }

    /**
     * Coverage per block: {@code battingOrder} and {@code toss} (non-forfeit results that recorded which side batted first,
     * and the toss), {@code availability} (non-forfeit results with a closed availability poll for this team), {@code
     * runCards} and {@code wicketCards} (usable batting and bowling innings with the card captured) and {@code
     * closeMargins} (regular wins that stored a margin).
     */
    public record MyTeamCoverage(
            MyTeamCount battingOrder,
            MyTeamCount toss,
            MyTeamCount availability,
            MyTeamCount runCards,
            MyTeamCount wicketCards,
            MyTeamCount closeMargins) {
    }

    /** One of the last five counted results, newest first; {@code result} is WON, LOST, TIED, DRAWN or NO_RESULT. */
    public record MyTeamFormEntry(
            UUID matchId, Instant matchDate, String opponentName, boolean derby, String result, boolean forfeit) {
    }

    // ---- series (docs/specs/117 team shapes, without the internal result ids) ----

    /**
     * The team Dashboard series for the Hub: chronological (oldest first), the last {@code window.pointLimit} points of the
     * covered history. {@code extrasConceded} is the extras the team gave away, by match (the Extras card's back).
     */
    public record MyTeamSeries(
            DashboardWindowDto window,
            List<MyTeamResult> results,
            TeamDashboardResultsSummary resultsSummary,
            List<MyTeamRunRatePoint> runRateTrend,
            MyTeamNetRunRateTrend netRunRateTrend,
            List<MyTeamExtrasPoint> extrasConceded,
            TeamDashboardExtrasSummary extrasSummary,
            List<MyTeamDotBallsPoint> dotBalls,
            TeamDashboardDotBallsSummary dotBallsSummary) {
    }

    /** One counted result: see {@code TeamDashboardDto.TeamDashboardResult}. */
    public record MyTeamResult(
            UUID matchId,
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

    /** Running team and opposition run rates after one result. */
    public record MyTeamRunRatePoint(
            UUID matchId, Instant matchDate, String opponentName, BigDecimal teamRunRate, BigDecimal oppositionRunRate) {
    }

    /** {@code status}: SHOWN, NOT_ONE_COMPETITION or NO_USABLE_RESULTS; {@code points} only when SHOWN. */
    public record MyTeamNetRunRateTrend(String status, List<MyTeamNetRunRatePoint> points) {
    }

    /** The running net run rate after one usable result. */
    public record MyTeamNetRunRatePoint(UUID matchId, Instant matchDate, String opponentName, BigDecimal value) {
    }

    /** Extras the team gave away in one result's opposition innings; components are null when not recorded. */
    public record MyTeamExtrasPoint(
            UUID matchId,
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

    /** Dot balls in one result's opposition innings; null when not every bowler row recorded dots. */
    public record MyTeamDotBallsPoint(
            UUID matchId,
            Instant matchDate,
            String opponentName,
            boolean derby,
            Integer ballsBowled,
            Integer dots,
            BigDecimal dotPercent) {
    }

    // ---- contribution ----

    /** Where the runs and the wickets come from. */
    public record MyTeamContribution(MyTeamShareBlock runs, MyTeamShareBlock wickets) {
    }

    /**
     * {@code total} is the team's runs (or wickets taken) in the usable innings, null when there is none; {@code lines} are
     * the top five contributors, Others, Extras (runs only, when recorded) and whatever the scorecards do not attribute, in
     * that order, adding up to {@code total}. {@code inningsWithCard} of {@code inningsCounted} usable innings had the
     * batting (or bowling) card captured.
     */
    public record MyTeamShareBlock(Long total, List<MyTeamShareLine> lines, long inningsWithCard, long inningsCounted) {
    }

    /**
     * {@code kind}: PLAYER, GUESTS, OTHERS, EXTRAS or NOT_ATTRIBUTED; {@code label} is the full name (PLAYER) or the line's
     * name; {@code sharePercent} (1 decimal) is {@code value} of the block total.
     */
    public record MyTeamShareLine(String kind, String label, long value, BigDecimal sharePercent) {
    }

    // ---- matchups ----

    /** {@code played} results of this kind and the {@code won} among them. */
    public record MyTeamSplit(long played, long won) {
    }

    /** Batting first v chasing; only the {@code recorded} of {@code counted} non-forfeit results that recorded the order are in the splits. */
    public record MyTeamBattingOrder(MyTeamSplit battingFirst, MyTeamSplit chasing, long recorded, long counted) {
    }

    /** {@code won} is null when no result recorded the toss; {@code partly} when only some did ({@code known} of {@code counted}). */
    public record MyTeamToss(Long won, long known, long counted, boolean partly) {
    }

    /** All counted results against one opponent name as recorded (null: none recorded), oldest first in {@code results}. */
    public record MyTeamHeadToHead(
            String opponentName,
            long played,
            long won,
            long lost,
            long tied,
            long drawn,
            long noResult,
            List<MyTeamMeeting> results) {
    }

    /** One meeting; {@code result} is WON, LOST, TIED, DRAWN or NO_RESULT. */
    public record MyTeamMeeting(UUID matchId, Instant matchDate, String result, boolean forfeit) {
    }

    // ---- squad ----

    /**
     * {@code playersUsed}: distinct registered players in the counted results; {@code guestAppearances}: guest or
     * unconfirmed rows; {@code averageAvailable} (1 decimal, null without a poll): players who answered "available" per
     * closed availability poll, over {@code matchesWithPoll} of {@code counted} results; {@code partly} when not every
     * counted result has a poll.
     */
    public record MyTeamSquad(
            long playersUsed,
            long guestAppearances,
            BigDecimal averageAvailable,
            long matchesWithPoll,
            long counted,
            boolean partly) {
    }

    /**
     * Regular wins and losses decided by fewer than {@code closeRuns} runs or {@code closeWickets} wickets: {@code played}
     * and {@code won}. {@code decided} counted results were decided, {@code withMargin} of them stored a margin.
     */
    public record MyTeamCloseGames(
            long played, long won, int closeRuns, int closeWickets, long decided, long withMargin) {
    }

    // ---- extras card ----

    /** Extras given away and received; {@code partly} when some innings did not itemise wides, no-balls, byes and leg byes. */
    public record MyTeamExtrasCard(MyTeamExtrasSide gaveAway, MyTeamExtrasSide received, boolean partly) {
    }

    /**
     * {@code total} is null when no innings recorded one; {@code sharePercent} (1 decimal) is those extras over the runs
     * conceded (gave away) or scored (received) in the same innings.
     */
    public record MyTeamExtrasSide(
            Long total,
            BigDecimal sharePercent,
            MyTeamExtrasComponent wides,
            MyTeamExtrasComponent noBalls,
            MyTeamExtrasComponent byes,
            MyTeamExtrasComponent legByes,
            MyTeamExtrasComponent penaltyRuns,
            long inningsWithExtras,
            long inningsCounted) {
    }

    /** {@code value} is null when no innings recorded it; {@code inningsRecorded} of {@code inningsCounted} innings did. */
    public record MyTeamExtrasComponent(Long value, long inningsRecorded, long inningsCounted) {
    }

    // ---- docs/specs/147 amendment 3: Team Stats on a par with Player Stats (all additive, history-capped like the series) ----

    /** One dismissal or wicket type: {@code type} is the {@code DismissalType} name; {@code percent} is relative to the block's own total (see the block). */
    public record MyTeamTypeCount(String type, String label, long count, BigDecimal percent) {
    }

    /**
     * How the team's batters got out, over the team's counted usable innings (the capped history). {@code notOut} counts
     * batters not out (not out and retired not out); {@code wickets} the dismissals (every other batted type, including
     * run out and retired out); {@code types} the dismissal types with a count, in the type order, each {@code percent} the
     * share of {@code notOut + wickets} (all batted innings of the team's batters, not-outs included, so the percents and
     * the not-out share add to 100). {@code notRecorded}: batting rows with no how-out (not in any percent). Did not bat is
     * never counted. {@code coverage}: innings with a recorded how-out of the usable innings.
     */
    public record MyTeamDismissals(
            long notOut, long wickets, List<MyTeamTypeCount> types, long notRecorded, MyTeamCount coverage) {
    }

    /**
     * Batting by position, positions 1 and 2 as one {@code OPENER} group, then {@code 3} to {@code 11}; positions with no
     * innings are left out. {@code sharePercent}: the group's runs over the runs of all the groups (the runs attributed to a
     * batting position), 1 decimal. {@code average}: runs per dismissal (null with none).
     */
    public record MyTeamPositionGroup(
            String key,
            String label,
            long innings,
            long runs,
            BigDecimal sharePercent,
            long notOuts,
            long dismissals,
            BigDecimal average) {
    }

    /**
     * Fours and sixes from the innings whose every batting row recorded both ({@code inningsRecorded} of {@code
     * inningsCounted} usable innings). {@code boundaryRuns} = 4 x fours + 6 x sixes; {@code boundaryPercent}: that over the
     * team runs of those innings; {@code ballsPerBoundary}: valid balls faced over fours + sixes, for the recorded innings
     * whose every row also had valid balls. Null when nothing is recorded (never 0).
     */
    public record MyTeamBoundaries(
            Long fours,
            Long sixes,
            Long boundaryRuns,
            BigDecimal boundaryPercent,
            BigDecimal ballsPerBoundary,
            long inningsRecorded,
            long inningsCounted) {
    }

    /**
     * The team at one playing area (the result's area, else the match's): {@code venueKey} is the area id, {@code unknown}
     * (no area recorded) or {@code other} (the venues beyond the twelve busiest). {@code home}: one of the club's own home
     * fields (null for unknown and other). Counted non-forfeit results only. The four totals are sums over the usable
     * innings and null when none was recorded.
     */
    public record MyTeamVenue(
            String venueKey,
            String name,
            Boolean home,
            long matches,
            long won,
            long lost,
            long tied,
            Long runsScored,
            Long runsConceded,
            Long wicketsTaken,
            Long wicketsLost) {
    }

    /**
     * How the team's bowlers took wickets, from the stored bowling wickets of the opposition's usable innings split by the
     * dismissal types of the batters named against the bowler (bowler-credited types only; run-outs are never a bowler's).
     * {@code total} = Σ types + {@code notItemised}; each {@code percent} is the share of {@code total}.
     * {@code coverage}: opposition usable innings with a bowling card of those counted.
     */
    public record MyTeamWicketTypes(
            long total, List<MyTeamTypeCount> types, long notItemised, MyTeamCount coverage) {
    }

    /**
     * Fielding credits of the team's own fielders over the counted non-forfeit results: totals, per counted result with
     * fielding recorded, the top eight fielders ({@code others}: the total of the rest) and {@code coverage} (results with a
     * fielding record of those counted). Full names, Hub only; guests and unconfirmed import guesses grouped as "Guests".
     */
    public record MyTeamFielding(
            long catches,
            long stumpings,
            long runOuts,
            long dismissals,
            BigDecimal dismissalsPerMatch,
            List<MyTeamFielder> byFielder,
            long others,
            MyTeamCount coverage) {
    }

    /** One fielder's credits. */
    public record MyTeamFielder(String name, long catches, long stumpings, long runOuts, long total) {
    }

    /** Batting first ({@code first}) v chasing: results that recorded the order, with the team's usable innings in them. */
    public record MyTeamInningsSplit(MyTeamInningsSide first, MyTeamInningsSide chasing) {
    }

    /** {@code runs} is the total of the usable innings (null with none); {@code average} is runs per such innings. */
    public record MyTeamInningsSide(long played, long won, long innings, Long runs, BigDecimal average) {
    }
}
