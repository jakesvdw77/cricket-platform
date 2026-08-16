package com.cricketlegend.service;

import com.cricketlegend.domain.LeadStatus;
import com.cricketlegend.dto.CreateLeadRequest;
import com.cricketlegend.dto.LeadDto;
import com.cricketlegend.dto.UpdateLeadStatusRequest;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface LeadService {

    LeadDto create(CreateLeadRequest request);

    /**
     * Backend-driven pagination, per docs/standards/backend.md — the follow-up queue can grow
     * unbounded. Defaults to newest-first when the caller doesn't specify a sort.
     */
    Page<LeadDto> list(LeadStatus statusFilter, Pageable pageable);

    LeadDto transitionStatus(UUID id, UpdateLeadStatusRequest request);
}
