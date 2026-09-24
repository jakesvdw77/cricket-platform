package com.cricketlegend.repository;

import com.cricketlegend.domain.LeagueAffiliation;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * See docs/specs/029-league-management.md. {@link #existsByLeagueIdAndTeamIdAndSeasonId} backs
 * the triple-uniqueness 409 check ahead of the DB unique constraint.
 */
public interface LeagueAffiliationRepository extends JpaRepository<LeagueAffiliation, UUID> {

    List<LeagueAffiliation> findByLeagueId(UUID leagueId);

    boolean existsByLeagueIdAndTeamIdAndSeasonId(UUID leagueId, UUID teamId, UUID seasonId);

    /**
     * Per docs/specs/050-league-schedule-and-fixtures.md: the distinct-team count per league for a
     * single {@code seasonId}, in one round trip for a club's whole league collection —
     * backs {@code LeagueDto.currentSeasonTeamCount} in {@code LeagueServiceImpl.list()} (never a
     * per-league query). Spring Data interface projection ({@link LeagueTeamCount}), the first one
     * in this codebase — kept in this file, close to the query it backs.
     */
    @Query("select a.leagueId as leagueId, count(distinct a.teamId) as teamCount "
            + "from LeagueAffiliation a where a.seasonId = :seasonId group by a.leagueId")
    List<LeagueTeamCount> countDistinctTeamsBySeasonId(@Param("seasonId") UUID seasonId);

    /** Projection backing {@link #countDistinctTeamsBySeasonId}. */
    interface LeagueTeamCount {
        UUID getLeagueId();

        long getTeamCount();
    }
}
