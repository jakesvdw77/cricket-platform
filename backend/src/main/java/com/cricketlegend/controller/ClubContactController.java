package com.cricketlegend.controller;

import com.cricketlegend.dto.ClubContactDto;
import com.cricketlegend.dto.CreateClubContactRequest;
import com.cricketlegend.dto.UpdateClubContactRequest;
import com.cricketlegend.service.ClubContactService;
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
 * docs/specs/021-club-contacts.md: list/create/update/deactivate/reactivate for a club's named
 * contacts, on {@code /api/v1/manage/clubs/{clubId}/contacts} only — no {@code /platform} mirror
 * (see the spec's API Contract Architecture note: {@link
 * com.cricketlegend.config.AccessService#canAdministerClub} already gives a {@code
 * platform_admin} superset access on {@code /manage/**}). {@code /api/v1/manage/**} is only
 * {@code authenticated()} at the URL level ({@link com.cricketlegend.config.SecurityConfig}), so
 * every endpoint here carries its own real {@code @PreAuthorize} — no exceptions.
 */
@RestController
public class ClubContactController {

    private final ClubContactService clubContactService;

    public ClubContactController(ClubContactService clubContactService) {
        this.clubContactService = clubContactService;
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/contacts")
    public ResponseEntity<List<ClubContactDto>> list(@PathVariable UUID clubId) {
        return ResponseEntity.ok(clubContactService.list(clubId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/contacts")
    @ApiResponse(responseCode = "201", description = "Club contact created")
    public ResponseEntity<ClubContactDto> create(
            @PathVariable UUID clubId, @Valid @RequestBody CreateClubContactRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(clubContactService.create(clubId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/contacts/{contactId}")
    public ResponseEntity<ClubContactDto> update(
            @PathVariable UUID clubId,
            @PathVariable UUID contactId,
            @Valid @RequestBody UpdateClubContactRequest request) {
        return ResponseEntity.ok(clubContactService.update(clubId, contactId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/contacts/{contactId}/deactivate")
    public ResponseEntity<ClubContactDto> deactivate(
            @PathVariable UUID clubId, @PathVariable UUID contactId) {
        return ResponseEntity.ok(clubContactService.deactivate(clubId, contactId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/contacts/{contactId}/reactivate")
    public ResponseEntity<ClubContactDto> reactivate(
            @PathVariable UUID clubId, @PathVariable UUID contactId) {
        return ResponseEntity.ok(clubContactService.reactivate(clubId, contactId));
    }
}
