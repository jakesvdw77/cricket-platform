package com.cricketlegend.dto;

import com.cricketlegend.dto.LeaderboardCatalogueDto.LeaderboardBoardInfo;
import com.cricketlegend.dto.LeaderboardPageDto.LeaderboardRow;
import com.cricketlegend.dto.LeaderboardPageDto.LeaderboardScope;
import java.util.List;

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
}
