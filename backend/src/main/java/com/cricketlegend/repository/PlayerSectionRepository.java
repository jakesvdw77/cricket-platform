package com.cricketlegend.repository;

import java.util.Collection;
import com.cricketlegend.domain.PlayerSection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Every currently-tagged {@link com.cricketlegend.domain.Section} for a {@link
 * com.cricketlegend.domain.PlayerProfile}, and the reverse-direction lookups the link/unlink
 * business rules need — same method shape as {@code TeamSponsorRepository}. See
 * docs/specs/028-players.md.
 */
public interface PlayerSectionRepository extends JpaRepository<PlayerSection, UUID> {

    List<PlayerSection> findByPlayerProfileId(UUID playerProfileId);

    /** Batch form of {@link #findByPlayerProfileId}, so a list maps without one query per player. */
    List<PlayerSection> findByPlayerProfileIdIn(Collection<UUID> playerProfileIds);

    /**
     * Every {@code PlayerProfile} tagged to {@code sectionId} — the "eligible for section"
     * audience a {@link com.cricketlegend.domain.SectionAvailabilityWindow} asks, per
     * docs/specs/063-section-availability-and-flexible-squads.md.
     */
    List<PlayerSection> findBySectionId(UUID sectionId);

    boolean existsByPlayerProfileIdAndSectionId(UUID playerProfileId, UUID sectionId);

    Optional<PlayerSection> findByPlayerProfileIdAndSectionId(UUID playerProfileId, UUID sectionId);

    void deleteByPlayerProfileIdAndSectionId(UUID playerProfileId, UUID sectionId);

    /**
     * Batch lookup for the player availability grid (docs/specs/068-player-availability-grid.md):
     * exact section ids only; callers pass the descendant-inclusive set.
     */
    List<PlayerSection> findBySectionIdIn(Collection<UUID> sectionIds);
}
