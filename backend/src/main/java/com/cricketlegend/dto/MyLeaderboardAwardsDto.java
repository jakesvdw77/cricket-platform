package com.cricketlegend.dto;

import com.cricketlegend.dto.AwardsViewDto.AwardsBasis;
import com.cricketlegend.dto.AwardsViewDto.AwardsMinimums;
import com.cricketlegend.dto.AwardsViewDto.AwardsOmittedCategory;
import com.cricketlegend.dto.AwardsViewDto.LeaderboardDetail;
import com.cricketlegend.dto.AwardsViewDto.LeaderboardRunsNotOut;
import com.cricketlegend.dto.AwardsViewDto.LeaderboardSample;
import com.cricketlegend.dto.AwardsViewDto.LeaderboardWicketsRuns;
import com.cricketlegend.dto.LeaderboardCatalogueDto.LeaderboardBoardInfo;
import com.cricketlegend.dto.MyLeaderboardTableDto.MyLeaderboardScope;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * docs/specs/147 Open question 2: the category leaders of the club's Awards categories for the Player Hub reach, shown
 * only for a season that has ended. While {@code revealed} is false there are no leaders: {@code reason} is
 * SEASON_NOT_ENDED (the chosen season is still running or not started, or no season is chosen and one is running) or
 * RANKINGS_NOT_SHARED (the club's {@code HubRankingPolicy} does not allow rankings), {@code message} is the sentence to
 * show and {@code seasonEndDate} the day the chosen season ends (null when no single season applies). Revealed leaders are
 * every player at rank 1 of a category (a tie gives joint leaders); no row carries a player id.
 */
public record MyLeaderboardAwardsDto(
        MyLeaderboardScope scope,
        boolean revealed,
        String reason,
        String message,
        LocalDate seasonEndDate,
        AwardsBasis basis,
        AwardsMinimums minimums,
        List<MyAwardsCategory> categories,
        List<AwardsOmittedCategory> omitted) {

    public record MyAwardsCategory(LeaderboardBoardInfo board, List<MyAwardsLeader> leaders) {
    }

    /** A leader; {@code mine} is true for the held player. {@code figure} is as on the manager Awards view. */
    public record MyAwardsLeader(
            Integer rank,
            boolean mine,
            String firstName,
            String lastName,
            @Schema(oneOf = {BigDecimal.class, LeaderboardWicketsRuns.class, LeaderboardRunsNotOut.class},
                    nullable = true)
            Object figure,
            long matches,
            Long innings,
            LeaderboardSample sample,
            boolean smallSample,
            LeaderboardDetail detail) {
    }
}
