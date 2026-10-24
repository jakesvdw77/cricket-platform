package com.cricketlegend.repository;

import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonLinkStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Touched only by the link services (docs/specs/119). */
public interface PersonLinkRepository extends JpaRepository<PersonLink, UUID> {

    /** The caller's ACTIVE links among the given subjects (any club): used to hide players already held. */
    @Query("""
            select l from PersonLink l
            where l.accountPersonId = :accountPersonId and l.status = :status
              and l.subjectPersonId in :subjectPersonIds
            """)
    List<PersonLink> findByAccountAndSubjects(
            @Param("accountPersonId") UUID accountPersonId,
            @Param("status") PersonLinkStatus status,
            @Param("subjectPersonIds") Collection<UUID> subjectPersonIds);

    /** The ACTIVE main-agent links of the given subjects (any club). */
    @Query("""
            select l from PersonLink l
            where l.main = true and l.status = com.cricketlegend.domain.PersonLinkStatus.ACTIVE
              and l.subjectPersonId in :subjectPersonIds
            """)
    List<PersonLink> findActiveMains(@Param("subjectPersonIds") Collection<UUID> subjectPersonIds);

    /** The ACTIVE links for one player at one club (any agent, main first is the caller's job). */
    @Query("""
            select l from PersonLink l
            where l.subjectPersonId = :subjectPersonId and l.clubId = :clubId
              and l.status = com.cricketlegend.domain.PersonLinkStatus.ACTIVE
            """)
    List<PersonLink> findActiveBySubjectAndClub(
            @Param("subjectPersonId") UUID subjectPersonId, @Param("clubId") UUID clubId);

    /** The ACTIVE links of the given players at one club, in one query (docs/specs/119 Player accounts page). */
    @Query("""
            select l from PersonLink l
            where l.subjectPersonId in :subjectPersonIds and l.clubId = :clubId
              and l.status = com.cricketlegend.domain.PersonLinkStatus.ACTIVE
            """)
    List<PersonLink> findActiveBySubjectsAndClub(
            @Param("subjectPersonIds") Collection<UUID> subjectPersonIds, @Param("clubId") UUID clubId);

    /** The account's INVITED or ACTIVE link to this player at this club, if any (the open-link unique index). */
    Optional<PersonLink> findFirstByAccountPersonIdAndSubjectPersonIdAndClubIdAndStatusIn(
            UUID accountPersonId, UUID subjectPersonId, UUID clubId, Collection<PersonLinkStatus> statuses);

    /** The account's links in one status (docs/specs/119 My players: the ACTIVE ones). */
    List<PersonLink> findByAccountPersonIdAndStatus(UUID accountPersonId, PersonLinkStatus status);

    /** Invitations (INVITED, not expired) waiting for this verified email, oldest first (docs/specs/119, slice 4). */
    @Query("""
            select l from PersonLink l
            where l.status = com.cricketlegend.domain.PersonLinkStatus.INVITED
              and lower(l.invitedEmail) = lower(:email)
              and (l.expiresAt is null or l.expiresAt > :now)
            order by l.createdAt
            """)
    List<PersonLink> findOpenInvitationsForEmail(
            @Param("email") String email, @Param("now") java.time.Instant now);

    /** Invitations (INVITED, not expired) already sent for one player at one club. */
    @Query("""
            select l from PersonLink l
            where l.subjectPersonId = :subjectPersonId and l.clubId = :clubId
              and l.status = com.cricketlegend.domain.PersonLinkStatus.INVITED
              and (l.expiresAt is null or l.expiresAt > :now)
            order by l.createdAt
            """)
    List<PersonLink> findOpenInvitationsBySubjectAndClub(
            @Param("subjectPersonId") UUID subjectPersonId,
            @Param("clubId") UUID clubId,
            @Param("now") java.time.Instant now);

    /** Invitations (INVITED, not expired) waiting for this email, counted for the chooser card. */
    @Query("""
            select count(l) from PersonLink l
            where l.status = com.cricketlegend.domain.PersonLinkStatus.INVITED
              and lower(l.invitedEmail) = lower(:email)
              and (l.expiresAt is null or l.expiresAt > :now)
            """)
    long countOpenInvitationsForEmail(@Param("email") String email, @Param("now") java.time.Instant now);
}
