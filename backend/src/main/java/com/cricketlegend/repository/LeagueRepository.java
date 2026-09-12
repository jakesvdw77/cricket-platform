package com.cricketlegend.repository;

import com.cricketlegend.domain.League;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * No paginated/derived list method — {@code list(clubId)} is a deliberately small, bounded
 * collection, matching {@code SponsorRepository}/{@code TeamRepository}'s precedent. See
 * docs/specs/029-league-management.md.
 */
public interface LeagueRepository extends JpaRepository<League, UUID> {

    List<League> findByClubId(UUID clubId);
}
