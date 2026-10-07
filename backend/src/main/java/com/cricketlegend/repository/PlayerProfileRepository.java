package com.cricketlegend.repository;

import com.cricketlegend.domain.PlayerProfile;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * No paginated/derived list method — {@link #findByClubId} is a deliberately small, bounded
 * collection, matching {@code TeamRepository}/{@code SectionRepository}'s precedent. See
 * docs/specs/028-players.md.
 */
public interface PlayerProfileRepository extends JpaRepository<PlayerProfile, UUID> {

    List<PlayerProfile> findByClubId(UUID clubId);

    /**
     * The club's players whose linked {@code Person} has no date of birth, active and inactive
     * alike (same status behaviour as {@link #findByClubId}) — the 077 "fix the data" filter.
     * One joined query, so the caller never loads persons one by one.
     */
    @Query("""
            select p from PlayerProfile p, Person pe
            where pe.id = p.personId and p.clubId = :clubId and pe.dateOfBirth is null
            """)
    List<PlayerProfile> findByClubIdWithoutDateOfBirth(@Param("clubId") UUID clubId);

    /** Active players of the club — the manager overview's key figure for an unrestricted caller (079). */
    long countByClubIdAndActiveTrue(UUID clubId);

    /** Active players of the club among {@code ids} — the overview figure for a section-scoped caller (079). */
    long countByClubIdAndActiveTrueAndIdIn(UUID clubId, java.util.Collection<UUID> ids);
}
