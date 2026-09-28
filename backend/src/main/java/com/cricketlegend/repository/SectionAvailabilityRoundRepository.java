package com.cricketlegend.repository;

import com.cricketlegend.domain.SectionAvailabilityRound;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Small, bounded, unpaginated — same {@code TeamServiceImpl.listByClub}-style in-memory-filter
 * precedent as {@code SectionAvailabilityWindowRepository}'s own identical shape. Per the
 * fixture-group-selection revision, a round no longer carries a {@code roundDate}, so {@code
 * existsBySectionIdAndRoundDate}/{@code findBySectionIdAndRoundDate} are no longer meaningful and
 * have been dropped — a round's own identity is just its id (see Data Model Changes, "no
 * uniqueness constraint on this table at all"). See
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public interface SectionAvailabilityRoundRepository extends JpaRepository<SectionAvailabilityRound, UUID> {

    List<SectionAvailabilityRound> findByClubId(UUID clubId);
}
