package com.cricketlegend.repository;

import com.cricketlegend.domain.ClubContact;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * No paginated/derived list method — {@code list(clubId)} (all contacts for a club) is a
 * deliberately small, bounded collection, not the "unbounded growth" case
 * docs/standards/backend.md's pagination rule targets (see docs/plans/021-club-contacts.md's
 * Context). See docs/specs/021-club-contacts.md.
 */
public interface ClubContactRepository extends JpaRepository<ClubContact, UUID> {

    List<ClubContact> findByClubId(UUID clubId);

    /**
     * The currently-flagged active primary contact for a club, if any — used by the service to
     * auto-unset the previous primary when a new one is flagged. At most one row per club given
     * the DB-level partial unique index ({@code ux_club_contact_primary}), but returned as a
     * {@code List} rather than a single optional result since Spring Data's derived-query
     * singular return would throw on more than one row — belt-and-braces against the very race
     * the index guards against.
     */
    List<ClubContact> findByClubIdAndActiveTrueAndIsPrimaryTrue(UUID clubId);
}
