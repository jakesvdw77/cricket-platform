package com.cricketlegend.repository;

import com.cricketlegend.domain.LinkRequest;
import com.cricketlegend.domain.LinkRequestStatus;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Touched only by the link services (docs/specs/119). */
public interface LinkRequestRepository extends JpaRepository<LinkRequest, UUID> {

    List<LinkRequest> findByAccountPersonIdOrderByCreatedAtDesc(UUID accountPersonId);

    List<LinkRequest> findByClubIdAndStatusOrderByCreatedAtAsc(UUID clubId, LinkRequestStatus status);

    Optional<LinkRequest> findByIdAndClubId(UUID id, UUID clubId);

    long countByAccountPersonIdAndClubIdAndStatus(UUID accountPersonId, UUID clubId, LinkRequestStatus status);

    /** The same account already waiting on the same typed player at the same club: a repeat adds nothing. */
    boolean existsByAccountPersonIdAndClubIdAndStatusAndTypedDateOfBirthAndTypedFirstNameIgnoreCaseAndTypedLastNameIgnoreCase(
            UUID accountPersonId,
            UUID clubId,
            LinkRequestStatus status,
            LocalDate typedDateOfBirth,
            String typedFirstName,
            String typedLastName);

    /**
     * Atomically takes a PENDING request for a decision: the row changes only while it is still PENDING, so of two
     * managers (or a double click) deciding at once exactly one gets 1 and the other 0 (the update waits for the row lock,
     * then re-checks the status). The caller then fills in the rest of the decision on the same row.
     */
    @Modifying
    @Query("""
            update LinkRequest r
            set r.status = :status, r.decidedAt = :decidedAt, r.decidedByPersonId = :decidedBy, r.decisionNote = :note
            where r.id = :id and r.status = com.cricketlegend.domain.LinkRequestStatus.PENDING
            """)
    int claim(
            @Param("id") UUID id,
            @Param("status") LinkRequestStatus status,
            @Param("decidedAt") java.time.Instant decidedAt,
            @Param("decidedBy") UUID decidedBy,
            @Param("note") String note);
}
