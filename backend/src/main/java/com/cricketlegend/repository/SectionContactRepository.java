package com.cricketlegend.repository;

import com.cricketlegend.domain.SectionContact;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Every currently-linked {@link com.cricketlegend.domain.ClubContact} for a {@link
 * com.cricketlegend.domain.Section} node, and the reverse-direction lookups the link/unlink
 * business rules need. See docs/specs/025-club-structure.md.
 */
public interface SectionContactRepository extends JpaRepository<SectionContact, UUID> {

    List<SectionContact> findBySectionId(UUID sectionId);

    boolean existsBySectionIdAndClubContactId(UUID sectionId, UUID clubContactId);

    Optional<SectionContact> findBySectionIdAndClubContactId(UUID sectionId, UUID clubContactId);

    void deleteBySectionIdAndClubContactId(UUID sectionId, UUID clubContactId);
}
