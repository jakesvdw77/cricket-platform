package com.cricketlegend.repository;

import com.cricketlegend.domain.ClubProfile;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * No custom queries — lookup is always by the shared {@code club_id} PK. See
 * docs/specs/012-club-profile.md.
 */
public interface ClubProfileRepository extends JpaRepository<ClubProfile, UUID> {
}
