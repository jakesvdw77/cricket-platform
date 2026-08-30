package com.cricketlegend.repository;

import com.cricketlegend.domain.Section;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * No paginated/derived list method — {@code list(clubId)} (every section for a club) is a
 * deliberately small, bounded collection, matching {@code ClubContactRepository}'s precedent. See
 * docs/specs/025-club-structure.md.
 */
public interface SectionRepository extends JpaRepository<Section, UUID> {

    List<Section> findByClubId(UUID clubId);

    /**
     * Every active direct child of {@code parentSectionId} — used by the service to block a
     * deactivate while any direct child is still active (see docs/specs/025-club-structure.md's
     * Data Model Changes).
     */
    List<Section> findByParentSectionIdAndActiveTrue(UUID parentSectionId);
}
