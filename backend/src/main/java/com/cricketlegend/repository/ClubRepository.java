package com.cricketlegend.repository;

import com.cricketlegend.domain.Club;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClubRepository extends JpaRepository<Club, UUID> {

    /**
     * Typeahead search for the root domain's "find your club" login step
     * (docs/specs/004-landing-page.md) — ACTIVE clubs only, matched case-insensitively
     * against name or slug.
     */
    @Query("SELECT c FROM Club c WHERE c.status = com.cricketlegend.domain.ClubStatus.ACTIVE "
            + "AND (LOWER(c.name) LIKE LOWER(CONCAT('%', :query, '%')) "
            + "OR LOWER(c.slug) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<Club> searchActiveByNameOrSlug(@Param("query") String query);

    /**
     * The public landing search (docs/specs/149): same match as {@link #searchActiveByNameOrSlug}, ordered by
     * name so the caller can bound it with a {@link Pageable}.
     */
    @Query("SELECT c FROM Club c WHERE c.status = com.cricketlegend.domain.ClubStatus.ACTIVE "
            + "AND (LOWER(c.name) LIKE LOWER(CONCAT('%', :query, '%')) "
            + "OR LOWER(c.slug) LIKE LOWER(CONCAT('%', :query, '%'))) ORDER BY c.name ASC, c.id ASC")
    List<Club> searchActiveByNameOrSlugOrdered(@Param("query") String query, Pageable pageable);

    /** One club by slug (case-insensitive) in the given status, for the public by-slug lookup (docs/specs/149). */
    Optional<Club> findBySlugIgnoreCaseAndStatus(String slug, com.cricketlegend.domain.ClubStatus status);

    /** ACTIVE clubs by name, for the link request club picker (docs/specs/119). */
    List<Club> findByStatusOrderByNameAsc(com.cricketlegend.domain.ClubStatus status);

    boolean existsBySlugIgnoreCase(String slug);

    boolean existsBySlugIgnoreCaseAndIdNot(String slug, UUID id);

    /**
     * Case-insensitive substring match against name or slug, for the platform_admin onboarding
     * list (docs/specs/010-minimal-club-creation.md). Deliberately no status filter — unlike
     * {@link #searchActiveByNameOrSlug}, this admin list must show every Club regardless of
     * status. A null or blank search returns every Club.
     */
    @Query("SELECT c FROM Club c WHERE (:search IS NULL OR :search = '' "
            + "OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) "
            + "OR LOWER(c.slug) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Club> search(@Param("search") String search, Pageable pageable);
}
