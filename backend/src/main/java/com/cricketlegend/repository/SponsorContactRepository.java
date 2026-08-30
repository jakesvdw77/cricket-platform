package com.cricketlegend.repository;

import com.cricketlegend.domain.SponsorContact;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * No paginated/derived list method — {@code list(sponsorId)} (all contacts for a sponsor) is a
 * deliberately small, bounded collection, not the "unbounded growth" case
 * docs/standards/backend.md's pagination rule targets, matching {@code ClubContactRepository}'s
 * existing precedent. See docs/specs/024-sponsor-contacts.md.
 */
public interface SponsorContactRepository extends JpaRepository<SponsorContact, UUID> {

    List<SponsorContact> findBySponsorId(UUID sponsorId);

    /**
     * The currently-flagged active primary contact for a sponsor, if any — used by the service to
     * auto-unset the previous primary when a new one is flagged. At most one row per sponsor given
     * the DB-level partial unique index ({@code ux_sponsor_contact_primary}), but returned as a
     * {@code List} rather than a single optional result since Spring Data's derived-query
     * singular return would throw on more than one row — belt-and-braces against the very race
     * the index guards against. Mirrors {@code ClubContactRepository.findByClubIdAndActiveTrueAndIsPrimaryTrue}.
     */
    List<SponsorContact> findBySponsorIdAndActiveTrueAndIsPrimaryTrue(UUID sponsorId);
}
