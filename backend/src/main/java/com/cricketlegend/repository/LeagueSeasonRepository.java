package com.cricketlegend.repository;

import com.cricketlegend.domain.LeagueSeason;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** docs/specs/111-league-season-dates.md. */
public interface LeagueSeasonRepository extends JpaRepository<LeagueSeason, UUID> {

    Optional<LeagueSeason> findByLeagueIdAndSeasonId(UUID leagueId, UUID seasonId);

    /** The cross product of the leagues and seasons in one query; callers keep only the exact pairs they need. */
    List<LeagueSeason> findByLeagueIdInAndSeasonIdIn(Collection<UUID> leagueIds, Collection<UUID> seasonIds);
}
