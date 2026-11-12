package com.cricketlegend.dto;

import com.cricketlegend.domain.AwardType;
import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.ResultSide;
import java.util.List;

/**
 * docs/specs/145: one result for the Player Hub Result page. {@code mine} is the held player's own card, the same row
 * the list returns for the match (it also carries the match header: date, league, sides, scores, result line).
 * {@code innings} is the full scorecard of both sides with names in full (juniors included, spec Decision 7). It carries no
 * result id, entry id or player id; {@code mine} flags on a batter or bowler mark the held player. Fielding credits are
 * not listed: the dismissals name the bowler and fielder.
 */
public record MyResultDto(
        MyResultRowDto mine, String venue, List<Innings> innings, List<Award> awards) {

    /** One regular innings: the batting side's card and the other side's bowling. {@code overs} is e.g. {@code 36.4}. */
    public record Innings(
            int sequence,
            ResultSide battingSide,
            String battingTeamName,
            Integer runs,
            Integer wickets,
            String overs,
            Integer extras,
            Integer wides,
            Integer noBalls,
            Integer byes,
            Integer legByes,
            Integer penaltyRuns,
            List<Batter> batting,
            List<String> didNotBat,
            List<Bowler> bowling) {}

    /** {@code howOut} is null when not recorded; {@code bowler} and {@code fielder} are full names or null. */
    public record Batter(
            String name,
            boolean mine,
            Integer position,
            DismissalType howOut,
            String bowler,
            String fielder,
            Integer runs,
            Integer balls,
            Integer fours,
            Integer sixes) {}

    /** {@code overs} is the balls shown as overs (e.g. {@code 8.2}); optional figures are null when not recorded. */
    public record Bowler(
            String name,
            boolean mine,
            String overs,
            Integer maidens,
            Integer runs,
            Integer wickets,
            Integer wides,
            Integer noBalls,
            Integer dots) {}

    public record Award(AwardType type, ResultSide side, String playerName) {}
}
