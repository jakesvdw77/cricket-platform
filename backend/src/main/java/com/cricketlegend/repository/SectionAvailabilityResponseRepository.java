package com.cricketlegend.repository;

import com.cricketlegend.domain.SectionAvailabilityResponse;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** See docs/specs/063-section-availability-and-flexible-squads.md. */
public interface SectionAvailabilityResponseRepository extends JpaRepository<SectionAvailabilityResponse, UUID> {

    List<SectionAvailabilityResponse> findByWindowId(UUID windowId);

    Optional<SectionAvailabilityResponse> findByWindowIdAndPlayerProfileId(UUID windowId, UUID playerProfileId);
}
