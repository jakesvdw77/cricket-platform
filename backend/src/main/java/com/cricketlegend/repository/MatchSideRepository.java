package com.cricketlegend.repository;

import com.cricketlegend.domain.MatchSide;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** See docs/specs/029-league-management.md. */
public interface MatchSideRepository extends JpaRepository<MatchSide, UUID> {

    List<MatchSide> findByMatchId(UUID matchId);

    Optional<MatchSide> findByMatchIdAndTeamId(UUID matchId, UUID teamId);

    boolean existsByMatchIdAndTeamId(UUID matchId, UUID teamId);

    /** Batched lookup for {@code MatchServiceImpl.list()}'s per-page announced-status enrichment (040). */
    List<MatchSide> findByMatchIdIn(Collection<UUID> matchIds);

    /**
     * docs/specs/109-delete-empty-match.md: which of these matches have a side with content (one query for a page): a
     * selected player, an announced selection, or a captain, wicket-keeper or twelfth man. An empty, unannounced side
     * (made by merely opening Team selection) is not content.
     */
    @Query("""
            select distinct s.matchId from MatchSide s
            where s.matchId in :matchIds
              and (s.announced = true
                   or s.captainPlayerId is not null
                   or s.wicketKeeperPlayerId is not null
                   or s.twelfthManPlayerId is not null
                   or exists (select 1 from MatchSidePlayer p where p.matchSideId = s.id))
            """)
    List<UUID> findMatchIdsWithSideByMatchIdIn(@Param("matchIds") Collection<UUID> matchIds);
}
