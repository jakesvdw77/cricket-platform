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
     * remove while any direct child is still active (see docs/specs/025-club-structure.md's
     * Data Model Changes).
     */
    List<Section> findByParentSectionIdAndActiveTrue(UUID parentSectionId);

    /**
     * Whether {@code parentSectionId} has ANY direct child at all, active or inactive — used by
     * the remove-eligibility rule to decide hard-delete vs. soft-deactivate. Deliberately broader
     * than {@link #findByParentSectionIdAndActiveTrue}: an inactive child row would still violate
     * this table's own {@code parent_section_id} FK if the parent were deleted out from under it.
     */
    boolean existsByParentSectionId(UUID parentSectionId);
}
