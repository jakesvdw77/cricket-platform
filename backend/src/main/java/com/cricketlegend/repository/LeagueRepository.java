package com.cricketlegend.repository;

import com.cricketlegend.domain.League;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * No paginated/derived list method — {@code list(clubId)} is a deliberately small, bounded
 * collection, matching {@code SponsorRepository}/{@code TeamRepository}'s precedent. See
 * docs/specs/029-league-management.md.
 */
public interface LeagueRepository extends JpaRepository<League, UUID> {

    /**
     * Fetch-joins {@code socialLinks} so {@code LeagueServiceImpl.list} maps every league without
     * one lazy collection query per league (docs/specs/071-league-card-redesign.md's N+1 guard).
     */
    @Query("select distinct l from League l left join fetch l.socialLinks where l.clubId = :clubId")
    List<League> findByClubId(@Param("clubId") UUID clubId);

    /**
     * Whether the club already has a league with this name, ignoring case and surrounding spaces, active or inactive
     * (docs/specs/096-duplicate-league.md). {@code name} must already be trimmed.
     */
    @Query("select count(l) > 0 from League l where l.clubId = :clubId and lower(trim(l.name)) = lower(:name)")
    boolean existsByClubIdAndNameIgnoreCase(@Param("clubId") UUID clubId, @Param("name") String name);
}
