package com.cricketlegend.repository;

import com.cricketlegend.domain.LinkRequest;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Touched only by the link services (docs/specs/119); first used in slice 3B. */
public interface LinkRequestRepository extends JpaRepository<LinkRequest, UUID> {}
