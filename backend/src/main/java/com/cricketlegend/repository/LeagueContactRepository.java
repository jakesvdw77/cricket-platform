package com.cricketlegend.repository;

import com.cricketlegend.domain.LeagueContact;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * No paginated/derived list method — {@code list(leagueId)} (all contacts for a league) is a
 * deliberately small, bounded collection, not the "unbounded growth" case
 * docs/standards/backend.md's pagination rule targets, matching {@code SponsorContactRepository}'s
 * existing precedent. See docs/specs/054-league-contacts.md.
 */
public interface LeagueContactRepository extends JpaRepository<LeagueContact, UUID> {

    List<LeagueContact> findByLeagueId(UUID leagueId);

    /**
     * The currently-flagged active primary contact for a league, if any — used by the service to
     * auto-unset the previous primary when a new one is flagged. At most one row per league given
     * the DB-level partial unique index ({@code ux_league_contact_primary}), but returned as a
     * {@code List} rather than a single optional result since Spring Data's derived-query
     * singular return would throw on more than one row — belt-and-braces against the very race
     * the index guards against. Mirrors {@code SponsorContactRepository.findBySponsorIdAndActiveTrueAndIsPrimaryTrue}.
     */
    List<LeagueContact> findByLeagueIdAndActiveTrueAndIsPrimaryTrue(UUID leagueId);
}
