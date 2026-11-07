package com.cricketlegend.dto;

import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardCell;
import com.cricketlegend.dto.MyLeaderboardTableDto.MyLeaderboardScope;
import java.math.BigDecimal;
import java.util.List;

/**
 * docs/specs/147, "Where Sam stands": the held player's ordinal place among the players of the leaderboard reach in five
 * headline figures (runs, batting average, strike rate, fours, sixes, wickets, economy and catches). Every figure and every order is the one the
 * standings tables use. {@code lines} is empty when {@code HubRankingPolicy} does not allow rankings; a line's {@code
 * rank} is null when the player has no figure in it (or is below the minimum of a rate). No player id and no other
 * player's name appears.
 */
public record MyLeaderboardStandingDto(
        MyLeaderboardScope scope,
        String playerFirstName,
        long resultsCounted,
        long playersInReach,
        List<MyStandingLine> lines) {

    /**
     * One headline. {@code key} is runs, average, strikeRate, fours, sixes, wickets, economy or catches; {@code group} is
     * batting, bowling or fielding (the table the line comes from). {@code rank} (competition rank, ties share) is out of {@code
     * playersRanked}; {@code playersListed} is everyone the table lists for the group. {@code value} is the player's
     * cell of the matching standings column (null parts when there is no figure). {@code minimum} is set for the rate lines
     * only (average, strikeRate, economy): players below it are not ranked, and {@code belowMinimum} says the held player is one.
     */
    public record MyStandingLine(
            String key,
            String group,
            String label,
            Integer rank,
            long playersListed,
            long playersRanked,
            LeaderboardCell value,
            MyStandingSample sample,
            MyStandingMinimum minimum,
            boolean belowMinimum) {
    }

    /**
     * The sample behind the line: matches always; batting lines add innings and balls faced; the economy line adds balls,
     * overs (null when over lengths are mixed) and balls per over.
     */
    public record MyStandingSample(
            long matches, Long innings, Long ballsFaced, Long balls, BigDecimal overs, Integer ballsPerOver) {
    }

    /** The minimum a rate line applies: {@code unit} is INNINGS or OVERS. */
    public record MyStandingMinimum(String unit, int value) {
    }
}
