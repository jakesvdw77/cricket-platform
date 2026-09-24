package com.cricketlegend.repository;

import com.cricketlegend.domain.LeaguePlayingConditions;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * See docs/specs/050-league-schedule-and-fixtures.md. {@link #findByLeagueIdAndSeasonId} backs
 * both the GET and upsert-check paths for a single pair; {@link #findBySeasonId} backs {@code
 * LeagueServiceImpl}'s batch computed-field query for {@code LeagueDto.currentSeasonPlayingConditionsUrl}
 * (one query per club's whole league collection, not per league).
 */
public interface LeaguePlayingConditionsRepository extends JpaRepository<LeaguePlayingConditions, UUID> {

    Optional<LeaguePlayingConditions> findByLeagueIdAndSeasonId(UUID leagueId, UUID seasonId);

    List<LeaguePlayingConditions> findBySeasonId(UUID seasonId);
}
