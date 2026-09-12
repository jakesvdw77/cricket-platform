package com.cricketlegend.repository;

import com.cricketlegend.domain.Season;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * No paginated/derived list method — {@code list(clubId)} is a deliberately small, bounded
 * collection, matching {@code SponsorRepository}/{@code TeamRepository}'s precedent. See
 * docs/specs/029-league-management.md.
 */
public interface SeasonRepository extends JpaRepository<Season, UUID> {

    List<Season> findByClubId(UUID clubId);
}
