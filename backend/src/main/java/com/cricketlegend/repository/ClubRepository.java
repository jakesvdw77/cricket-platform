package com.cricketlegend.repository;

import com.cricketlegend.domain.Club;
import java.util.List;
import java.util.UUID;
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
}
