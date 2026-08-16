package com.cricketlegend.controller;

import com.cricketlegend.domain.LeadStatus;
import com.cricketlegend.dto.CreateLeadRequest;
import com.cricketlegend.dto.LeadDto;
import com.cricketlegend.dto.UpdateLeadStatusRequest;
import com.cricketlegend.service.LeadService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/004-landing-page.md: public lead capture, plus the platform_admin follow-up queue.
 * Authorization for /api/v1/platform/** is enforced by
 * {@link com.cricketlegend.config.SecurityConfig}'s URL-based platform_admin check.
 */
@RestController
public class LeadController {

    private final LeadService leadService;

    public LeadController(LeadService leadService) {
        this.leadService = leadService;
    }

    @PostMapping("/api/v1/leads")
    public ResponseEntity<LeadDto> create(@Valid @RequestBody CreateLeadRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(leadService.create(request));
    }

    @GetMapping("/api/v1/platform/leads")
    public ResponseEntity<Page<LeadDto>> list(
            @RequestParam(required = false) LeadStatus status, Pageable pageable) {
        return ResponseEntity.ok(leadService.list(status, pageable));
    }

    @PostMapping("/api/v1/platform/leads/{id}/status")
    public ResponseEntity<LeadDto> transitionStatus(
            @PathVariable UUID id, @Valid @RequestBody UpdateLeadStatusRequest request) {
        return ResponseEntity.ok(leadService.transitionStatus(id, request));
    }
}
