package com.cricketlegend.repository;

import com.cricketlegend.domain.Sponsor;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * No paginated/derived list method — {@code list(clubId)} (all sponsors for a club) is a
 * deliberately small, bounded collection, not the "unbounded growth" case
 * docs/standards/backend.md's pagination rule targets, matching {@code ClubContactRepository}'s
 * existing precedent. See docs/specs/023-sponsors.md.
 */
public interface SponsorRepository extends JpaRepository<Sponsor, UUID> {

    List<Sponsor> findByClubId(UUID clubId);
}
