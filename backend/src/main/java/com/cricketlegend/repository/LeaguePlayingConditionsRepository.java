package com.cricketlegend.repository;

import com.cricketlegend.domain.LeaguePlayingConditions;
import java.util.Collection;
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

    /**
     * Batch lookup for {@code SelectionLimitsResolver} (docs/specs/076-team-selection.md): the cross
     * product of {@code leagueIds} x {@code seasonIds}; callers keep only the exact pairs they need.
     */
    List<LeaguePlayingConditions> findByLeagueIdInAndSeasonIdIn(
            Collection<UUID> leagueIds, Collection<UUID> seasonIds);

    /** The league's rows for the given seasons in one query, for duplicating it (docs/specs/096-duplicate-league.md). */
    List<LeaguePlayingConditions> findByLeagueIdAndSeasonIdIn(UUID leagueId, Collection<UUID> seasonIds);
}
