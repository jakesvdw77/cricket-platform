package com.cricketlegend.repository;

import com.cricketlegend.domain.PlayerProfile;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * No paginated/derived list method — {@link #findByClubId} is a deliberately small, bounded
 * collection, matching {@code TeamRepository}/{@code SectionRepository}'s precedent. See
 * docs/specs/028-players.md.
 */
public interface PlayerProfileRepository extends JpaRepository<PlayerProfile, UUID> {

    List<PlayerProfile> findByClubId(UUID clubId);
}
