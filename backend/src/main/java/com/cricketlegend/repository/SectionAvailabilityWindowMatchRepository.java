package com.cricketlegend.repository;

import com.cricketlegend.domain.SectionAvailabilityWindowMatch;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * See {@link SectionAvailabilityWindowMatch} and
 * docs/specs/063-section-availability-and-flexible-squads.md's fixture-group-selection revision.
 */
public interface SectionAvailabilityWindowMatchRepository extends JpaRepository<SectionAvailabilityWindowMatch, UUID> {

    boolean existsByMatchId(UUID matchId);

    Optional<SectionAvailabilityWindowMatch> findByMatchId(UUID matchId);

    void deleteByWindowIdIn(Collection<UUID> windowIds);

    List<SectionAvailabilityWindowMatch> findByWindowId(UUID windowId);

    List<SectionAvailabilityWindowMatch> findByWindowIdIn(Collection<UUID> windowIds);

    /** Batch lookup for the player availability grid (docs/specs/068-player-availability-grid.md). */
    List<SectionAvailabilityWindowMatch> findByMatchIdIn(Collection<UUID> matchIds);
}
