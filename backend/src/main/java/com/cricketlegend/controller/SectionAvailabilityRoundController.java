package com.cricketlegend.controller;

import com.cricketlegend.dto.CreateSectionAvailabilityRoundRequest;
import com.cricketlegend.dto.SectionAvailabilityFixtureGroupDto;
import com.cricketlegend.dto.SectionAvailabilityRoundDto;
import com.cricketlegend.dto.SectionAvailabilityRoundMatchDto;
import com.cricketlegend.dto.SectionAvailabilityRoundResponsesDto;
import com.cricketlegend.dto.SetSectionAvailabilityRoundPlayerRequest;
import com.cricketlegend.dto.UpdateSectionAvailabilityRoundDescriptionRequest;
import com.cricketlegend.service.SectionAvailabilityFixtureGroupResolver;
import com.cricketlegend.service.SectionAvailabilityRoundService;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/063-section-availability-and-flexible-squads.md: a club's {@code
 * SectionAvailabilityRound}s, on {@code
 * /api/v1/manage/clubs/{clubId}/section-availability-rounds} — the fixture-group-selection
 * revision's own admin surface. Per docs/specs/035-section-scoped-access.md (already built): every
 * endpoint here except {@link #fixtureGroups} uses the broad {@code canAccessClub} gate, matching
 * {@code MatchAvailabilityPollController}'s own precedent for resources without a {@code
 * sectionId} path variable — the actual section-scoped check happens in the service layer.
 * {@link #fixtureGroups} is the one Part A endpoint gated directly at the controller with {@code
 * canAdministerSection}, since it's the one endpoint that actually carries a real {@code
 * sectionId} path variable, mirroring {@code TeamController}'s own pattern — this is intentional,
 * not an inconsistency, per the spec's own API Contract note.
 */
@RestController
public class SectionAvailabilityRoundController {

    private final SectionAvailabilityRoundService sectionAvailabilityRoundService;
    private final SectionAvailabilityFixtureGroupResolver sectionAvailabilityFixtureGroupResolver;

    public SectionAvailabilityRoundController(
            SectionAvailabilityRoundService sectionAvailabilityRoundService,
            SectionAvailabilityFixtureGroupResolver sectionAvailabilityFixtureGroupResolver) {
        this.sectionAvailabilityRoundService = sectionAvailabilityRoundService;
        this.sectionAvailabilityFixtureGroupResolver = sectionAvailabilityFixtureGroupResolver;
    }

    @PreAuthorize("@access.canAdministerSection(authentication, #clubId, #sectionId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/sections/{sectionId}/section-availability-fixture-groups")
    public ResponseEntity<List<SectionAvailabilityFixtureGroupDto>> fixtureGroups(
            Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID sectionId) {
        return ResponseEntity.ok(sectionAvailabilityFixtureGroupResolver.resolveGroups(clubId, sectionId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/section-availability-rounds")
    public ResponseEntity<List<SectionAvailabilityRoundDto>> list(
            Authentication authentication,
            @PathVariable UUID clubId,
            @RequestParam(required = false) UUID sectionId,
            @RequestParam(required = false) Boolean open) {
        return ResponseEntity.ok(sectionAvailabilityRoundService.list(authentication, clubId, sectionId, open));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/section-availability-rounds")
    @ApiResponse(responseCode = "201", description = "Section availability round created")
    public ResponseEntity<SectionAvailabilityRoundDto> create(
            Authentication authentication,
            @PathVariable UUID clubId,
            @Valid @RequestBody CreateSectionAvailabilityRoundRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(sectionAvailabilityRoundService.create(authentication, clubId, request));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/section-availability-rounds/{roundId}")
    public ResponseEntity<SectionAvailabilityRoundDto> updateDescription(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID roundId,
            @Valid @RequestBody UpdateSectionAvailabilityRoundDescriptionRequest request) {
        return ResponseEntity.ok(
                sectionAvailabilityRoundService.updateDescription(authentication, clubId, roundId, request));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/section-availability-rounds/{roundId}/open")
    public ResponseEntity<SectionAvailabilityRoundDto> open(
            Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID roundId) {
        return ResponseEntity.ok(sectionAvailabilityRoundService.open(authentication, clubId, roundId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/section-availability-rounds/{roundId}/close")
    public ResponseEntity<SectionAvailabilityRoundDto> close(
            Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID roundId) {
        return ResponseEntity.ok(sectionAvailabilityRoundService.close(authentication, clubId, roundId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/section-availability-rounds/{roundId}/responses")
    public ResponseEntity<SectionAvailabilityRoundResponsesDto> getResponses(
            Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID roundId) {
        return ResponseEntity.ok(sectionAvailabilityRoundService.getResponses(authentication, clubId, roundId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/section-availability-rounds/{roundId}/matches")
    public ResponseEntity<List<SectionAvailabilityRoundMatchDto>> getMatches(
            Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID roundId) {
        return ResponseEntity.ok(sectionAvailabilityRoundService.getMatches(authentication, clubId, roundId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/section-availability-rounds/{roundId}/players/{playerProfileId}")
    public ResponseEntity<SectionAvailabilityRoundResponsesDto> setPlayerStatus(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID roundId,
            @PathVariable UUID playerProfileId,
            @Valid @RequestBody SetSectionAvailabilityRoundPlayerRequest request) {
        return ResponseEntity.ok(sectionAvailabilityRoundService.setPlayerStatus(
                authentication, clubId, roundId, playerProfileId, request.windowId(), request.status()));
    }
}
