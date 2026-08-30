package com.cricketlegend.repository;

import com.cricketlegend.domain.Team;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * No paginated/derived list method — both {@link #findByClubIdAndSectionId} and {@link
 * #findByClubId} return a deliberately small, bounded collection, matching {@code
 * SectionRepository}'s precedent. See docs/specs/026-teams.md.
 */
public interface TeamRepository extends JpaRepository<Team, UUID> {

    /** Every team under {@code sectionId}, scoped to {@code clubId} — backs the section-scoped list. */
    List<Team> findByClubIdAndSectionId(UUID clubId, UUID sectionId);

    /** Every team for {@code clubId}, flat, across all sections — backs the club-wide directory. */
    List<Team> findByClubId(UUID clubId);
}
