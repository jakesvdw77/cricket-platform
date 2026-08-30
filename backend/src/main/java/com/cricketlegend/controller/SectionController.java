package com.cricketlegend.controller;

import com.cricketlegend.dto.ClubContactDto;
import com.cricketlegend.dto.CreateSectionRequest;
import com.cricketlegend.dto.SectionDto;
import com.cricketlegend.dto.UpdateSectionRequest;
import com.cricketlegend.service.SectionService;
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
 * docs/specs/025-club-structure.md: list/create/update/deactivate/reactivate for a club's section
 * tree, plus link/unlink to docs/specs/021-club-contacts.md's existing {@code ClubContact}, on
 * {@code /api/v1/manage/clubs/{clubId}/sections} only — no {@code /platform} mirror (see the
 * spec's API Contract Architecture note: {@link
 * com.cricketlegend.config.AccessService#canAdministerClub} already gives a {@code
 * platform_admin} superset access on {@code /manage/**}). {@code /api/v1/manage/**} is only
 * {@code authenticated()} at the URL level ({@link com.cricketlegend.config.SecurityConfig}), so
 * every endpoint here carries its own real {@code @PreAuthorize} — no exceptions.
 */
@RestController
public class SectionController {

    private final SectionService sectionService;

    public SectionController(SectionService sectionService) {
        this.sectionService = sectionService;
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/sections")
    public ResponseEntity<List<SectionDto>> list(@PathVariable UUID clubId) {
        return ResponseEntity.ok(sectionService.list(clubId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/sections")
    @ApiResponse(responseCode = "201", description = "Section created")
    public ResponseEntity<SectionDto> create(
            @PathVariable UUID clubId, @Valid @RequestBody CreateSectionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(sectionService.create(clubId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/sections/{sectionId}")
    public ResponseEntity<SectionDto> update(
            @PathVariable UUID clubId,
            @PathVariable UUID sectionId,
            @Valid @RequestBody UpdateSectionRequest request) {
        return ResponseEntity.ok(sectionService.update(clubId, sectionId, request));
    }

    // Returns 200 + the updated SectionDto when soft-deactivated (it still has a linked contact),
    // or 204 with no body when the section had nothing attached to it and was actually deleted —
    // see docs/specs/025-club-structure.md's Data Model Changes Remove rule and this endpoint's
    // own Architecture note in the spec's API Contract.
    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/sections/{sectionId}/deactivate")
    public ResponseEntity<SectionDto> deactivate(
            @PathVariable UUID clubId, @PathVariable UUID sectionId) {
        return sectionService
                .deactivate(clubId, sectionId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/sections/{sectionId}/reactivate")
    public ResponseEntity<SectionDto> reactivate(
            @PathVariable UUID clubId, @PathVariable UUID sectionId) {
        return ResponseEntity.ok(sectionService.reactivate(clubId, sectionId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/sections/{sectionId}/contacts")
    public ResponseEntity<List<ClubContactDto>> listContacts(
            @PathVariable UUID clubId, @PathVariable UUID sectionId) {
        return ResponseEntity.ok(sectionService.listContacts(clubId, sectionId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/sections/{sectionId}/contacts/{contactId}/link")
    public ResponseEntity<Void> link(
            @PathVariable UUID clubId, @PathVariable UUID sectionId, @PathVariable UUID contactId) {
        sectionService.link(clubId, sectionId, contactId);
        return ResponseEntity.ok().build();
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/sections/{sectionId}/contacts/{contactId}/unlink")
    public ResponseEntity<Void> unlink(
            @PathVariable UUID clubId, @PathVariable UUID sectionId, @PathVariable UUID contactId) {
        sectionService.unlink(clubId, sectionId, contactId);
        return ResponseEntity.ok().build();
    }
}
