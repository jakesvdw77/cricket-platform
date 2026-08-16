package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Lead;
import com.cricketlegend.domain.LeadStatus;
import com.cricketlegend.dto.CreateLeadRequest;
import com.cricketlegend.dto.LeadDto;
import com.cricketlegend.dto.UpdateLeadStatusRequest;
import com.cricketlegend.exception.InvalidLeadFieldException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.LeadMapper;
import com.cricketlegend.repository.LeadRepository;
import com.cricketlegend.service.LeadService;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

/**
 * Enforces the allowed-transition table from docs/specs/004-landing-page.md:
 * NEW -> CONTACTED, NEW -> DISMISSED, CONTACTED -> CONVERTED, CONTACTED -> DISMISSED.
 * No transition out of CONVERTED or DISMISSED.
 */
@Service
public class LeadServiceImpl implements LeadService {

    private static final Map<LeadStatus, Set<LeadStatus>> ALLOWED_TRANSITIONS = Map.of(
            LeadStatus.NEW, Set.of(LeadStatus.CONTACTED, LeadStatus.DISMISSED),
            LeadStatus.CONTACTED, Set.of(LeadStatus.CONVERTED, LeadStatus.DISMISSED),
            LeadStatus.CONVERTED, Set.of(),
            LeadStatus.DISMISSED, Set.of());

    private final LeadRepository leadRepository;
    private final LeadMapper leadMapper;

    public LeadServiceImpl(LeadRepository leadRepository, LeadMapper leadMapper) {
        this.leadRepository = leadRepository;
        this.leadMapper = leadMapper;
    }

    @Override
    public LeadDto create(CreateLeadRequest request) {
        Lead lead = leadMapper.toEntity(request);
        lead.setStatus(LeadStatus.NEW);
        return leadMapper.toDto(leadRepository.save(lead));
    }

    @Override
    public Page<LeadDto> list(LeadStatus statusFilter, Pageable pageable) {
        Pageable effectivePageable = withDefaultSort(pageable);
        Page<Lead> leads = statusFilter == null
                ? leadRepository.findAll(effectivePageable)
                : leadRepository.findByStatus(statusFilter, effectivePageable);
        return leads.map(leadMapper::toDto);
    }

    private Pageable withDefaultSort(Pageable pageable) {
        if (pageable.getSort().isSorted()) {
            return pageable;
        }
        return PageRequest.of(
                pageable.getPageNumber(), pageable.getPageSize(), Sort.by("createdAt").descending());
    }

    @Override
    public LeadDto transitionStatus(UUID id, UpdateLeadStatusRequest request) {
        Lead lead = leadRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Lead not found: " + id));

        LeadStatus current = lead.getStatus();
        LeadStatus target = request.status();
        Set<LeadStatus> allowed = ALLOWED_TRANSITIONS.getOrDefault(current, Set.of());
        if (!allowed.contains(target)) {
            throw new InvalidStatusTransitionException(
                    "Cannot transition lead from " + current + " to " + target);
        }

        if (request.convertedClubId() != null && target != LeadStatus.CONVERTED) {
            throw new InvalidLeadFieldException(
                    "convertedClubId can only be set when transitioning to CONVERTED");
        }

        lead.setStatus(target);
        if (target == LeadStatus.CONTACTED) {
            lead.setContactedAt(Instant.now());
        }
        if (target == LeadStatus.CONVERTED) {
            lead.setConvertedClubId(request.convertedClubId());
        }

        return leadMapper.toDto(leadRepository.save(lead));
    }
}
