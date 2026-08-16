package com.cricketlegend.repository;

import com.cricketlegend.domain.Lead;
import com.cricketlegend.domain.LeadStatus;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LeadRepository extends JpaRepository<Lead, UUID> {

    /**
     * Backend-driven pagination, per docs/standards/backend.md — GET /api/v1/platform/leads'
     * follow-up queue can grow unbounded, so it's never returned as a full list.
     * {@link #findAll(Pageable)} (inherited) covers the unfiltered case.
     */
    Page<Lead> findByStatus(LeadStatus status, Pageable pageable);
}
