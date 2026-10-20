package com.cricketlegend.repository;

import com.cricketlegend.domain.MatchResult;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/**
 * docs/specs/103-player-stats.md: every additive counter of every player in a scope, from published results only,
 * grouped by player profile. The second permitted reader of the result tables after the result services
 * (docs/standards/backend.md, "Statistics"): it carries the publish gate itself as {@link
 * ResultVisibility#PUBLISHED_STATUS}, and is touched only by the statistics services (ArchUnit). It sums and counts
 * stored columns; {@code PlayerStatsCalculator} defines every figure. Native SQL: see {@link PlayerStatsSql}.
 *
 * <p>The entity type parameter is only what Spring Data requires of a repository; nothing here maps entities.
 */
public interface PlayerStatsAggregateRepository extends Repository<MatchResult, UUID> {

    /**
     * One row per player with a counted appearance; {@code playerId} null reads the whole club (boards), a value
     * restricts to that profile (the Player page, same query). Optional filters are null for "no filter";
     * {@code sectionTeamIds} must never be empty (pass a sentinel when {@code sectionRestricted} is false).
     */
    @Query(value = PlayerStatsSql.AGGREGATE, nativeQuery = true)
    List<PlayerStatsAggregateView> aggregate(
            @Param("clubId") UUID clubId,
            @Param("playerId") UUID playerId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds);

    /** One player's counters; the getter names are the quoted column aliases of {@link PlayerStatsSql#AGGREGATE}. */
    interface PlayerStatsAggregateView {
        UUID getPlayerId();

        Long getMatches();

        Long getResultsWithBattingCard();

        Long getResultsWithBowlingCard();

        Long getBatInnings();

        Long getBatNotOuts();

        Long getBatDismissals();

        Long getBatRuns();

        Long getBatBallsFaced();

        Long getBatInningsWithBalls();

        Long getBatRunsWithBalls();

        Long getBatFours();

        Long getBatSixes();

        Long getBatInningsWithBoundaries();

        Long getBatBoundaryRuns();

        Long getBatRunsWithBoundaries();

        Long getBatBallsForBoundaries();

        Long getBatBoundaryCount();

        Long getBatDucks();

        Long getBatGoldenDucks();

        Long getBatThirtyPlus();

        Long getBatFiftyPlus();

        Long getBatHundredPlus();

        Long getBatCenturies();

        Long getBatHalfCenturies();

        Long getBatHighestKey();

        Long getBowlInnings();

        Long getBowlBalls();

        Long getBowlRuns();

        Long getBowlWickets();

        Long getBowlMaidens();

        Long getBowlWides();

        Long getBowlNoBalls();

        Long getBowlDots();

        Long getBowlInningsWithWides();

        Long getBowlInningsWithNoBalls();

        Long getBowlInningsWithDots();

        Long getBowlBallsWithDots();

        BigDecimal getBowlOvers();

        /** Distinct balls-per-over values of rows that bowled, comma separated; null when none bowled. */
        String getBowlBallsPerOver();

        Long getBowlThreeWickets();

        Long getBowlFourWickets();

        Long getBowlFiveWickets();

        Long getBowlBestKey();

        Long getFieldCatches();

        Long getFieldStumpings();

        Long getFieldRunOuts();

        Long getAwardPlayerOfMatch();

        Long getAwardTeamPlayerOfMatch();

        Long getRecWon();

        Long getRecLost();

        Long getRecTied();

        Long getRecDrawn();

        Long getRecInternal();
    }
}
