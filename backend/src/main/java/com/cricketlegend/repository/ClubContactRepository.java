package com.cricketlegend.repository;

import com.cricketlegend.domain.ClubContact;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    // ---- docs/specs/148-player-hub-club-info.md: the Player Hub directory. ONLY MyClubInfoServiceImpl calls these. ----
    // They read club_contact alone (never person, player_profile or person_link), so no player or player's manager can
    // be returned or searched. :pattern is a lower-case LIKE pattern with '!' as the escape character ('%' matches
    // everything); :letter is '' (no letter), 'A' to 'Z', or '#' (a last name not starting with A to Z).

    /** One page of the club's active contacts, last name then first name. */
    @Query(value = "SELECT c.* FROM club_contact c WHERE c.club_id = :clubId AND c.active"
            + " AND (lower(c.first_name) LIKE :pattern ESCAPE '!' OR lower(c.last_name) LIKE :pattern ESCAPE '!'"
            + " OR lower(c.role) LIKE :pattern ESCAPE '!')"
            + " AND (:letter = '' OR (:letter = '#' AND c.last_name !~ '^[A-Za-z]')"
            + " OR (:letter <> '#' AND upper(left(c.last_name, 1)) = :letter))"
            + " ORDER BY c.last_name, c.first_name, c.id", nativeQuery = true)
    List<ClubContact> directoryByName(
            @Param("clubId") UUID clubId,
            @Param("pattern") String pattern,
            @Param("letter") String letter,
            Pageable pageable);

    /** One page of the club's active contacts, role then last name then first name. */
    @Query(value = "SELECT c.* FROM club_contact c WHERE c.club_id = :clubId AND c.active"
            + " AND (lower(c.first_name) LIKE :pattern ESCAPE '!' OR lower(c.last_name) LIKE :pattern ESCAPE '!'"
            + " OR lower(c.role) LIKE :pattern ESCAPE '!')"
            + " AND (:letter = '' OR (:letter = '#' AND c.last_name !~ '^[A-Za-z]')"
            + " OR (:letter <> '#' AND upper(left(c.last_name, 1)) = :letter))"
            + " ORDER BY c.role, c.last_name, c.first_name, c.id", nativeQuery = true)
    List<ClubContact> directoryByRole(
            @Param("clubId") UUID clubId,
            @Param("pattern") String pattern,
            @Param("letter") String letter,
            Pageable pageable);

    /** How many active contacts match the same filters (pattern '%' and letter '' counts all of them). */
    @Query(value = "SELECT count(*) FROM club_contact c WHERE c.club_id = :clubId AND c.active"
            + " AND (lower(c.first_name) LIKE :pattern ESCAPE '!' OR lower(c.last_name) LIKE :pattern ESCAPE '!'"
            + " OR lower(c.role) LIKE :pattern ESCAPE '!')"
            + " AND (:letter = '' OR (:letter = '#' AND c.last_name !~ '^[A-Za-z]')"
            + " OR (:letter <> '#' AND upper(left(c.last_name, 1)) = :letter))", nativeQuery = true)
    long countDirectory(
            @Param("clubId") UUID clubId, @Param("pattern") String pattern, @Param("letter") String letter);

    /**
     * The distinct first letters of last names in the set matched by {@code pattern} only (the {@code letter} filter is
     * deliberately not applied, so the jump strip keeps showing every letter of the searched set); '#' stands for every
     * last name not starting with A to Z. Unordered: the service sorts.
     */
    @Query(value = "SELECT DISTINCT CASE WHEN c.last_name ~ '^[A-Za-z]' THEN upper(left(c.last_name, 1)) ELSE '#' END"
            + " FROM club_contact c WHERE c.club_id = :clubId AND c.active"
            + " AND (lower(c.first_name) LIKE :pattern ESCAPE '!' OR lower(c.last_name) LIKE :pattern ESCAPE '!'"
            + " OR lower(c.role) LIKE :pattern ESCAPE '!')", nativeQuery = true)
    List<String> directoryLetters(@Param("clubId") UUID clubId, @Param("pattern") String pattern);
}
