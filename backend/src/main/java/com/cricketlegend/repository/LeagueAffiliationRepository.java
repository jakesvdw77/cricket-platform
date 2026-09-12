package com.cricketlegend.repository;

import com.cricketlegend.domain.LeagueAffiliation;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * See docs/specs/029-league-management.md. {@link #existsByLeagueIdAndTeamIdAndSeasonId} backs
 * the triple-uniqueness 409 check ahead of the DB unique constraint.
 */
public interface LeagueAffiliationRepository extends JpaRepository<LeagueAffiliation, UUID> {

    List<LeagueAffiliation> findByLeagueId(UUID leagueId);

    boolean existsByLeagueIdAndTeamIdAndSeasonId(UUID leagueId, UUID teamId, UUID seasonId);
}
