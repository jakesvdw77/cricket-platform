package com.cricketlegend.dto;

import com.cricketlegend.dto.LeaderboardCatalogueDto.LeaderboardBoardInfo;
import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardScope;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * docs/specs/103-player-stats.md, "Awards response": the leaders (every player at rank 1, so a tie gives joint winners) of
 * each category the club shows, from one aggregate read. {@code minimums} are the values used (absent request values mean
 * the filter-aware defaults). A category nobody qualifies for is listed in {@code omitted} with the reason, not shown empty.
 */
public record AwardsViewDto(
        LeaderboardScope scope,
        AwardsBasis basis,
        AwardsMinimums minimums,
        List<AwardsCategory> categories,
        List<AwardsOmittedCategory> omitted) {

    public record AwardsBasis(long resultsCounted, long playersConsidered) {
    }

    public record AwardsMinimums(int innings, int overs, int defaultInnings, int defaultOvers) {
    }

    public record AwardsCategory(LeaderboardBoardInfo board, List<LeaderboardRow> leaders) {
    }

    public record AwardsOmittedCategory(LeaderboardBoardInfo board, String reason) {
    }

    /** Best bowling figure: wickets for runs. */
    public record LeaderboardWicketsRuns(long wickets, long runs) {
    }

    /** Highest score figure: runs, starred when not out. */
    public record LeaderboardRunsNotOut(long runs, boolean notOut) {
    }

    /**
     * The sample behind a rate figure. Batting categories set {@code innings} and {@code ballsFaced}; bowling categories
     * set {@code balls}, {@code overs} (null when over lengths are mixed), {@code ballsPerOver} (the one over length, null
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
     * A leader. {@code figure} is a number, a {@link LeaderboardWicketsRuns}, a {@link LeaderboardRunsNotOut}, or null.
     * {@code innings} is batting innings on batting categories and bowling innings on bowling ones, null otherwise.
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
