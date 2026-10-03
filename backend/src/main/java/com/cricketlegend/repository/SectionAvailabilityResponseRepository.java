package com.cricketlegend.repository;

import com.cricketlegend.domain.SectionAvailabilityResponse;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** See docs/specs/063-section-availability-and-flexible-squads.md. */
public interface SectionAvailabilityResponseRepository extends JpaRepository<SectionAvailabilityResponse, UUID> {

    List<SectionAvailabilityResponse> findByWindowId(UUID windowId);

    void deleteByWindowIdIn(Collection<UUID> windowIds);

    Optional<SectionAvailabilityResponse> findByWindowIdAndPlayerProfileId(UUID windowId, UUID playerProfileId);

    /** Batch lookup for the player availability grid (docs/specs/068-player-availability-grid.md). */
    List<SectionAvailabilityResponse> findByWindowIdIn(Collection<UUID> windowIds);
}
