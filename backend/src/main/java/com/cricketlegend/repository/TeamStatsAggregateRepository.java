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
 * docs/specs/116-team-stats.md: every additive counter of every club team in a scope, from published results only,
 * grouped by team. A further permitted reader of the result tables (docs/standards/backend.md, "Statistics"): it carries
 * the publish gate itself through {@link StatsCountingSql}, and is touched only by the statistics services (ArchUnit). It
 * sums, counts and encodes maxima of stored columns; {@code TeamStatsCalculator} defines every figure. Native SQL: see
 * {@link TeamStatsSql}.
 *
 * <p>The entity type parameter is only what Spring Data requires of a repository; nothing here maps entities.
 */
public interface TeamStatsAggregateRepository extends Repository<MatchResult, UUID> {

    /**
     * One row per team with a counted team result. Optional filters are null for "no filter"; {@code sectionTeamIds} must
     * never be empty (pass a sentinel when {@code sectionRestricted} is false).
     */
    @Query(value = TeamStatsSql.AGGREGATE, nativeQuery = true)
    List<TeamStatsAggregateView> aggregate(
            @Param("clubId") UUID clubId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds);

    /** The scope-wide disclosure counters of the table's basis line (one row; a derby counts once). */
    @Query(value = TeamStatsSql.BASIS, nativeQuery = true)
    TeamStatsBasisView basis(
            @Param("clubId") UUID clubId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds);

    /** The scope-wide basis counters. */
    interface TeamStatsBasisView {
        Long getResultsCounted();

        Long getInternalResults();

        Long getResultsNoBallBowled();

        Long getForfeits();
    }

    /** One team's counters; the getter names are the quoted column aliases of {@link TeamStatsSql#AGGREGATE}. The keys are the encoded maxima and minima documented on {@link TeamStatsSql}. */
    interface TeamStatsAggregateView {
        UUID getTeamId();

        String getTeamName();

        UUID getSectionId();

        Boolean getActive();

        Long getResults();

        Long getRecWon();

        Long getRecLost();

        Long getRecTied();

        Long getRecDrawn();

        Long getRecNoResult();

        Long getRecForfeitsReceived();

        Long getRecForfeitsConceded();

        Long getRecInternal();

        Long getNoBallBowled();

        Long getBothInnings();

        Long getOwnInnings();

        Long getOwnUsable();

        Long getOwnRuns();

        Long getOwnWickets();

        Long getOwnBalls();

        Long getOwnRunsWithBalls();

        BigDecimal getOwnOvers();

        BigDecimal getHighTotalKey();

        BigDecimal getLowTotalKey();

        Long getHighLowInnings();

        Long getLowClassifiable();

        Long getOppInnings();

        Long getOppUsable();

        Long getOppRuns();

        Long getOppWickets();

        Long getOppBalls();

        Long getOppRunsWithBalls();

        BigDecimal getOppOvers();

        Long getExtrasInnings();

        Long getExtras();

        Long getWidesInnings();

        Long getWides();

        Long getNoBallsInnings();

        Long getNoBalls();

        Long getByesInnings();

        Long getByes();

        Long getLegByesInnings();

        Long getLegByes();

        Long getPenaltyInnings();

        Long getPenaltyRuns();

        BigDecimal getChaseKey();

        BigDecimal getVictoryRunsKey();

        BigDecimal getVictoryWicketsKey();

        Long getNrrMatches();

        Long getNrrOwnRuns();

        Long getNrrOppRuns();

        BigDecimal getNrrOwnOvers();

        BigDecimal getNrrOppOvers();

        Long getNrrLeagues();

        Long getNrrSeasons();

        UUID getNrrLeagueId();

        UUID getNrrSeasonId();
    }
}
