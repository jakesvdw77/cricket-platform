package com.cricketlegend.repository;

import com.cricketlegend.domain.LinkAttempt;
import com.cricketlegend.domain.LinkAttemptKind;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Touched only by the link services (docs/specs/119); first used in slice 3B. */
public interface LinkAttemptRepository extends JpaRepository<LinkAttempt, UUID> {

    Optional<LinkAttempt> findByAccountPersonIdAndKind(UUID accountPersonId, LinkAttemptKind kind);
}
