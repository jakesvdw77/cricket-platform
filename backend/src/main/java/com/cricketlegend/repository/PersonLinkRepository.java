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
}
