package com.cricketlegend.dto;

import com.cricketlegend.dto.LeaderboardCatalogueDto.LeaderboardBoardInfo;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/103-player-stats.md, "Board response": one page of one leaderboard for the filters echoed in {@code scope}.
 * Every figure is the {@code PlayerStatsCalculator} figure of the same player (parity with the Player page). Names are first
 * and last name only; the client formats them.
 */
public record LeaderboardPageDto(
        LeaderboardBoardInfo board,
        LeaderboardScope scope,
        LeaderboardMinimum minimum,
        LeaderboardBasis basis,
        LeaderboardPageInfo page,
        List<LeaderboardRow> rows) {

    /** The filters the figures were computed for ({@code kind} is always {@code CLUB_VERIFIED} in this part). */
    public record LeaderboardScope(String kind, UUID seasonId, UUID leagueId, UUID teamId, UUID sectionId) {
    }

    /**
     * {@code applies}: the board has an optional minimum; {@code value}: the one in force (null = none);
     * {@code suggestedDefault}: the filter-aware default (null when the board has no minimum); {@code unit}: NONE,
     * INNINGS or OVERS.
     */
    public record LeaderboardMinimum(boolean applies, Integer value, Integer suggestedDefault, String unit) {
    }

    /** How much data the page rests on; {@code coverage} is set only for boards built on optional columns. */
    public record LeaderboardBasis(
            long resultsCounted,
            long playersListed,
            long playersRanked,
            long belowMinimum,
            LeaderboardCoverage coverage) {
    }

    /** Innings that recorded the figure ({@code used}) out of innings counted ({@code counted}). */
    public record LeaderboardCoverage(long used, long counted) {
    }

    public record LeaderboardPageInfo(int number, int size, long totalElements, boolean hasMore) {
    }

    /** Best bowling figure: wickets for runs. */
    public record LeaderboardWicketsRuns(long wickets, long runs) {
    }

    /** Highest score figure: runs, starred when not out. */
    public record LeaderboardRunsNotOut(long runs, boolean notOut) {
    }

    /**
     * The sample behind a rate figure. Batting boards set {@code innings} and {@code ballsFaced}; bowling boards set
     * {@code balls}, {@code overs} (null when over lengths are mixed), {@code ballsPerOver} (the one over length, null
     * when mixed) and {@code wickets}.
     */
    public record LeaderboardSample(
            Long innings,
            Long ballsFaced,
            Long balls,
            BigDecimal overs,
            Integer ballsPerOver,
            Long wickets) {
    }

    /** The match of a single-innings figure (highest score, best bowling). */
    public record LeaderboardDetail(UUID matchId, Instant matchDate, String opponent) {
    }

    /**
     * {@code rank} is null for the unranked group (a rate board's players with no figure). {@code figure} is a number, a
     * {@link LeaderboardWicketsRuns}, a {@link LeaderboardRunsNotOut}, or null. {@code innings} is batting innings on
     * batting boards and bowling innings on bowling boards, null otherwise.
     */
    public record LeaderboardRow(
            Integer rank,
            UUID playerId,
            String firstName,
            String lastName,
            boolean active,
            @Schema(oneOf = {BigDecimal.class, LeaderboardWicketsRuns.class, LeaderboardRunsNotOut.class},
                    nullable = true)
            Object figure,
            long matches,
            Long innings,
            LeaderboardSample sample,
            boolean smallSample,
            LeaderboardDetail detail) {

        /** The same row with the match of its single-innings figure. */
        public LeaderboardRow withDetail(LeaderboardDetail newDetail) {
            return new LeaderboardRow(
                    rank, playerId, firstName, lastName, active, figure, matches, innings, sample, smallSample,
                    newDetail);
        }
    }
}
