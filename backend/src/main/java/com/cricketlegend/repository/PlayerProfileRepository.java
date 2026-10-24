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

    /**
     * The date of birth of each ACTIVE player among {@code ids}, in one joined query (the 077
     * public verify step). Inactive players are not returned at all.
     */
    @Query("""
            select p.id as playerProfileId, pe.dateOfBirth as dateOfBirth
            from PlayerProfile p, Person pe
            where pe.id = p.personId and p.active = true and p.id in :ids
            """)
    List<PlayerDateOfBirthView> findActiveDatesOfBirth(@Param("ids") java.util.Collection<UUID> ids);

    /** Active players of the club — the manager overview's key figure for an unrestricted caller (079). */
    long countByClubIdAndActiveTrue(UUID clubId);

    /** Active players of the club among {@code ids} — the overview figure for a section-scoped caller (079). */
    long countByClubIdAndActiveTrueAndIdIn(UUID clubId, java.util.Collection<UUID> ids);

    /**
     * The first and last name of every active player of the club, in one joined query (docs/specs/101): the scorecard
     * checks an unlinked guest name against these (normalised and case-insensitive in the caller).
     */
    @Query("""
            select p.id as playerProfileId, pe.firstName as firstName, pe.lastName as lastName
            from PlayerProfile p, Person pe
            where pe.id = p.personId and p.clubId = :clubId and p.active = true
            """)
    List<PlayerNameView> findActiveNamesByClubId(@Param("clubId") UUID clubId);

    /**
     * Active, verified players of any club whose contact email equals {@code email}, case-insensitively and except the
     * caller's own record (docs/specs/119 step 1): the only cross-club read of player data, backed by the {@code
     * lower(email)} index.
     */
    @Query("""
            select p from PlayerProfile p
            where p.active = true
              and p.verificationStatus = com.cricketlegend.domain.PlayerVerificationStatus.VERIFIED
              and lower(p.email) = lower(:email) and p.personId <> :excludePersonId
            """)
    List<PlayerProfile> findMatchesByEmail(
            @Param("email") String email, @Param("excludePersonId") UUID excludePersonId);

    /**
     * Every active player of the club with name and date of birth (docs/specs/119): link requests are matched against
     * these in memory with the lenient {@code PlayerNameMatcher}, one query for a whole queue.
     */
    @Query("""
            select p.id as playerProfileId, p.personId as personId, pe.firstName as firstName,
                   pe.lastName as lastName, pe.dateOfBirth as dateOfBirth
            from PlayerProfile p, Person pe
            where pe.id = p.personId and p.clubId = :clubId and p.active = true
            """)
    List<PlayerIdentityView> findActiveIdentitiesByClub(@Param("clubId") UUID clubId);

    /**
     * One page of the club's active players for "Players and their main agent" (docs/specs/119), ordered by name.
     * {@code restrictToSections} false ignores {@code sectionIds} (which must still be non-empty); {@code
     * noMainAgent} keeps only players with no ACTIVE main agent at this club; {@code pattern} is a lower-case
     * {@code %text%} (or {@code %} for no search).
     */
    @Query(value = """
            select p from PlayerProfile p, Person pe
            where pe.id = p.personId and p.clubId = :clubId and p.active = true
              and (:restrictToSections = false or exists (
                    select 1 from PlayerSection ps
                    where ps.playerProfileId = p.id and ps.sectionId in :sectionIds))
              and (:noMainAgent = false or not exists (
                    select 1 from PersonLink l
                    where l.subjectPersonId = p.personId and l.clubId = p.clubId and l.main = true
                      and l.status = com.cricketlegend.domain.PersonLinkStatus.ACTIVE))
              and (lower(pe.firstName) like :pattern or lower(pe.lastName) like :pattern
                   or lower(concat(pe.firstName, ' ', pe.lastName)) like :pattern)
            order by lower(pe.lastName), lower(pe.firstName), p.id
            """,
            countQuery = """
            select count(p) from PlayerProfile p, Person pe
            where pe.id = p.personId and p.clubId = :clubId and p.active = true
              and (:restrictToSections = false or exists (
                    select 1 from PlayerSection ps
                    where ps.playerProfileId = p.id and ps.sectionId in :sectionIds))
              and (:noMainAgent = false or not exists (
                    select 1 from PersonLink l
                    where l.subjectPersonId = p.personId and l.clubId = p.clubId and l.main = true
                      and l.status = com.cricketlegend.domain.PersonLinkStatus.ACTIVE))
              and (lower(pe.firstName) like :pattern or lower(pe.lastName) like :pattern
                   or lower(concat(pe.firstName, ' ', pe.lastName)) like :pattern)
            """)
    org.springframework.data.domain.Page<PlayerProfile> searchForAccounts(
            @Param("clubId") UUID clubId,
            @Param("restrictToSections") boolean restrictToSections,
            @Param("sectionIds") java.util.Collection<UUID> sectionIds,
            @Param("noMainAgent") boolean noMainAgent,
            @Param("pattern") String pattern,
            org.springframework.data.domain.Pageable pageable);

    /** The profiles of the given people at any club, in one query (docs/specs/119 My players: own record and links). */
    List<PlayerProfile> findByPersonIdIn(java.util.Collection<UUID> personIds);
}
