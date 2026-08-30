package com.cricketlegend.controller;

import com.cricketlegend.dto.CreateSponsorContactRequest;
import com.cricketlegend.dto.SponsorContactDto;
import com.cricketlegend.dto.UpdateSponsorContactRequest;
import com.cricketlegend.service.SponsorContactService;
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
 * docs/specs/024-sponsor-contacts.md: list/create/update/deactivate/reactivate for a sponsor's
 * named contacts, on {@code /api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts} only —
 * no {@code /platform} mirror (see the spec's API Contract Architecture note: {@link
 * com.cricketlegend.config.AccessService#canAdministerClub} already gives a {@code
 * platform_admin} superset access on {@code /manage/**}). {@code /api/v1/manage/**} is only
 * {@code authenticated()} at the URL level ({@link com.cricketlegend.config.SecurityConfig}), so
 * every endpoint here carries its own real {@code @PreAuthorize} — no exceptions.
 */
@RestController
public class SponsorContactController {

    private final SponsorContactService sponsorContactService;

    public SponsorContactController(SponsorContactService sponsorContactService) {
        this.sponsorContactService = sponsorContactService;
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts")
    public ResponseEntity<List<SponsorContactDto>> list(
            @PathVariable UUID clubId, @PathVariable UUID sponsorId) {
        return ResponseEntity.ok(sponsorContactService.list(clubId, sponsorId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts")
    @ApiResponse(responseCode = "201", description = "Sponsor contact created")
    public ResponseEntity<SponsorContactDto> create(
            @PathVariable UUID clubId,
            @PathVariable UUID sponsorId,
            @Valid @RequestBody CreateSponsorContactRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(sponsorContactService.create(clubId, sponsorId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts/{contactId}")
    public ResponseEntity<SponsorContactDto> update(
            @PathVariable UUID clubId,
            @PathVariable UUID sponsorId,
            @PathVariable UUID contactId,
            @Valid @RequestBody UpdateSponsorContactRequest request) {
        return ResponseEntity.ok(sponsorContactService.update(clubId, sponsorId, contactId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts/{contactId}/deactivate")
    public ResponseEntity<SponsorContactDto> deactivate(
            @PathVariable UUID clubId, @PathVariable UUID sponsorId, @PathVariable UUID contactId) {
        return ResponseEntity.ok(sponsorContactService.deactivate(clubId, sponsorId, contactId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts/{contactId}/reactivate")
    public ResponseEntity<SponsorContactDto> reactivate(
            @PathVariable UUID clubId, @PathVariable UUID sponsorId, @PathVariable UUID contactId) {
        return ResponseEntity.ok(sponsorContactService.reactivate(clubId, sponsorId, contactId));
    }
}
