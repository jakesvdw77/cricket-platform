package com.cricketlegend.dto;

import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardPageInfo;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/147, "MyStatsInningsPageDto": the match drill, one page of the innings, spells or matches behind a figure of
 * the My stats payload. The JSON keys are exactly the component names below. {@code kind} is BATTING, BOWLING, FIELDING or
 * MATCHES; {@code filter} echoes the token asked for (null when none); {@code title} and {@code filterLabel} are plain
 * header words. The set is the held player's counted, Player Hub results up to the history cap (300 matches, newest kept):
 * {@code truncated} says more existed. The page is cut on the server (newest first); {@code page.totalElements} is the
 * number of rows after the filter. Each row names only the match ({@code matchId}) and the opponent as recorded; no result
 * id or other internal id leaves. Only the block of the row's kind is filled (MATCHES rows fill all three where the player
 * took part); a figure that was not recorded is null, never 0.
 */
public record MyStatsInningsPageDto(
        String kind,
        String filter,
        String title,
        String filterLabel,
        boolean truncated,
        LeaderboardPageInfo page,
        List<MyStatsInningsRow> rows) {

    /** {@code result} is the result from the player's side (WON, LOST, TIED, DRAWN, NO_RESULT, ABANDONED, INTERNAL). */
    public record MyStatsInningsRow(
            UUID matchId,
            Instant matchDate,
            String opponentName,
            boolean derby,
            String ourTeamName,
            String result,
            MyStatsInningsBatting batting,
            MyStatsInningsBowling bowling,
            MyStatsInningsFielding fielding) {
    }

    /**
     * One batted innings (or, on a MATCHES row, the match's batting totals: {@code inningsNumber} null). {@code
     * bowlerName} is the bowler as recorded when the dismissal names one. {@code strikeRate} (2 decimals) is null without
     * valid balls.
     */
    public record MyStatsInningsBatting(
            Integer inningsNumber,
            Integer runs,
            Integer balls,
            Integer fours,
            Integer sixes,
            boolean notOut,
            String howOut,
            String bowlerName,
            BigDecimal strikeRate) {
    }

    /** One spell (or the match's bowling totals). {@code economy} (2 decimals) is null at zero balls. */
    public record MyStatsInningsBowling(
            long balls,
            int ballsPerOver,
            long maidens,
            long runs,
            long wickets,
            BigDecimal economy,
            Integer wides,
            Integer noBalls,
            Integer dots) {
    }

    /** The stored fielding credits of the match. */
    public record MyStatsInningsFielding(long catches, long stumpings, long runOuts) {
    }
}
