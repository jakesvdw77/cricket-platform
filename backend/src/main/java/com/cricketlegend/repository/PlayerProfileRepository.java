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

    /** Active players of the club — the manager overview's key figure for an unrestricted caller (079). */
    long countByClubIdAndActiveTrue(UUID clubId);

    /** Active players of the club among {@code ids} — the overview figure for a section-scoped caller (079). */
    long countByClubIdAndActiveTrueAndIdIn(UUID clubId, java.util.Collection<UUID> ids);
}
