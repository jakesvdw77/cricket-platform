package com.cricketlegend.controller;

import com.cricketlegend.dto.CreateSponsorRequest;
import com.cricketlegend.dto.SponsorDto;
import com.cricketlegend.dto.UpdateSponsorRequest;
import com.cricketlegend.service.SponsorService;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/023-sponsors.md: list/create/update/deactivate/reactivate for a club's sponsors, on
 * {@code /api/v1/manage/clubs/{clubId}/sponsors} only — no {@code /platform} mirror (see the
 * spec's API Contract Architecture note: {@link
 * com.cricketlegend.config.AccessService#canAdministerClub} already gives a {@code
 * platform_admin} superset access on {@code /manage/**}). {@code /api/v1/manage/**} is only
 * {@code authenticated()} at the URL level ({@link com.cricketlegend.config.SecurityConfig}), so
 * every endpoint here carries its own real {@code @PreAuthorize} — no exceptions.
 */
@RestController
public class SponsorController {

    private final SponsorService sponsorService;

    public SponsorController(SponsorService sponsorService) {
        this.sponsorService = sponsorService;
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/sponsors")
    public ResponseEntity<List<SponsorDto>> list(@PathVariable UUID clubId) {
        return ResponseEntity.ok(sponsorService.list(clubId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/sponsors")
    @ApiResponse(responseCode = "201", description = "Sponsor created")
    public ResponseEntity<SponsorDto> create(
            @PathVariable UUID clubId, @Valid @RequestBody CreateSponsorRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(sponsorService.create(clubId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}")
    public ResponseEntity<SponsorDto> update(
            @PathVariable UUID clubId,
            @PathVariable UUID sponsorId,
            @Valid @RequestBody UpdateSponsorRequest request) {
        return ResponseEntity.ok(sponsorService.update(clubId, sponsorId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/deactivate")
    public ResponseEntity<SponsorDto> deactivate(
            @PathVariable UUID clubId, @PathVariable UUID sponsorId) {
        return ResponseEntity.ok(sponsorService.deactivate(clubId, sponsorId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/reactivate")
    public ResponseEntity<SponsorDto> reactivate(
            @PathVariable UUID clubId, @PathVariable UUID sponsorId) {
        return ResponseEntity.ok(sponsorService.reactivate(clubId, sponsorId));
    }
}
