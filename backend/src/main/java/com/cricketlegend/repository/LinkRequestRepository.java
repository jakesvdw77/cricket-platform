package com.cricketlegend.repository;

import com.cricketlegend.domain.LinkRequest;
import com.cricketlegend.domain.LinkRequestStatus;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
