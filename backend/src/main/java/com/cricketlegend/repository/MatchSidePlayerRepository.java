package com.cricketlegend.repository;

import java.util.Collection;
import com.cricketlegend.domain.MatchSidePlayer;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** See docs/specs/029-league-management.md. */
public interface MatchSidePlayerRepository extends JpaRepository<MatchSidePlayer, UUID> {

    List<MatchSidePlayer> findByMatchSideIdOrderByBattingOrderAsc(UUID matchSideId);

    Optional<MatchSidePlayer> findByMatchSideIdAndPlayerProfileId(UUID matchSideId, UUID playerProfileId);

    boolean existsByMatchSideIdAndPlayerProfileId(UUID matchSideId, UUID playerProfileId);

    long countByMatchSideId(UUID matchSideId);

    void deleteByMatchSideIdAndPlayerProfileId(UUID matchSideId, UUID playerProfileId);

    /** Batch lookup for the player availability grid (docs/specs/068-player-availability-grid.md). */
    List<MatchSidePlayer> findByMatchSideIdIn(Collection<UUID> matchSideIds);

    /**
     * Players selected for at least one active match of {@code clubId} in {@code seasonId} (docs/specs/088): the Players
     * page "Players selected this season" counter and quick filter. Past and upcoming matches both count; a deactivated
     * match does not. One statement.
     */
    @Query("""
            select distinct p.playerProfileId
            from MatchSidePlayer p, MatchSide s, Match m
            where p.matchSideId = s.id and s.matchId = m.id
              and m.clubId = :clubId and m.seasonId = :seasonId and m.active = true
            """)
    List<UUID> findDistinctSelectedPlayerProfileIds(@Param("clubId") UUID clubId, @Param("seasonId") UUID seasonId);
}
