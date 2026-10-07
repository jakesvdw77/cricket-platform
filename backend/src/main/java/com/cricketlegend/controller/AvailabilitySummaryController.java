package com.cricketlegend.controller;

import com.cricketlegend.dto.AvailabilitySummaryDto;
import com.cricketlegend.service.AvailabilitySummaryService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/** docs/specs/081-plain-page-header-and-counters.md: the availability page counters. */
@RestController
public class AvailabilitySummaryController {

    private final AvailabilitySummaryService availabilitySummaryService;

    public AvailabilitySummaryController(AvailabilitySummaryService availabilitySummaryService) {
        this.availabilitySummaryService = availabilitySummaryService;
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/availability/summary")
    public ResponseEntity<AvailabilitySummaryDto> summary(Authentication authentication, @PathVariable UUID clubId) {
        return ResponseEntity.ok(availabilitySummaryService.summary(authentication, clubId));
    }
}
