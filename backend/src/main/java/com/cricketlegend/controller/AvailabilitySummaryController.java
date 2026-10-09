package com.cricketlegend.controller;

import com.cricketlegend.domain.AvailabilityPollTypeFilter;
import com.cricketlegend.domain.AvailabilitySummaryPlayerKind;
import com.cricketlegend.dto.AvailabilitySummaryDto;
import com.cricketlegend.dto.AvailabilitySummaryPlayerDto;
import com.cricketlegend.service.AvailabilitySummaryService;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** docs/specs/081-plain-page-header-and-counters.md: the availability page counters, filtered per spec 083. */
@RestController
public class AvailabilitySummaryController {

    private final AvailabilitySummaryService availabilitySummaryService;

    public AvailabilitySummaryController(AvailabilitySummaryService availabilitySummaryService) {
        this.availabilitySummaryService = availabilitySummaryService;
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/availability/summary")
    public ResponseEntity<AvailabilitySummaryDto> summary(
            Authentication authentication,
            @PathVariable UUID clubId,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID sectionId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(defaultValue = "ALL") AvailabilityPollTypeFilter type,
            @RequestParam(defaultValue = "false") boolean includeClosed) {
        return ResponseEntity.ok(availabilitySummaryService.summary(
                authentication, clubId, leagueId, sectionId, teamId, seasonId, type, includeClosed));
    }

    /**
     * docs/specs/084-clickable-counters.md: the players behind the responded / still-to-answer
     * counters, for the same filters. {@code kind} is {@code responded} or {@code awaiting} (400
     * if missing or otherwise); the page size is capped at 100.
     */
    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/availability/summary/players")
    public ResponseEntity<Page<AvailabilitySummaryPlayerDto>> players(
            Authentication authentication,
            @PathVariable UUID clubId,
            @RequestParam(required = false) String kind, // parse() turns a missing kind into the same 400 as a bad one
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID sectionId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(defaultValue = "ALL") AvailabilityPollTypeFilter type,
            @RequestParam(defaultValue = "false") boolean includeClosed,
            @RequestParam(defaultValue = "false") boolean closingSoon,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 25) Pageable pageable) {
        return ResponseEntity.ok(availabilitySummaryService.players(
                authentication,
                clubId,
                AvailabilitySummaryPlayerKind.parse(kind),
                leagueId,
                sectionId,
                teamId,
                seasonId,
                type,
                includeClosed,
                closingSoon,
                search,
                pageable));
    }
}
