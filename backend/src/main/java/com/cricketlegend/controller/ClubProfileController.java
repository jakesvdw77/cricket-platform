package com.cricketlegend.controller;

import com.cricketlegend.dto.ClubProfileDto;
import com.cricketlegend.dto.UpdateClubProfileRequest;
import com.cricketlegend.service.ClubProfileService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/012-club-profile.md: platform_admin-only Club profile get/upsert. GET relies on the
 * existing flat {@code /api/v1/platform/**} URL-matcher gate ({@link
 * com.cricketlegend.config.SecurityConfig}) only. PUT additionally carries a scope-shaped
 * {@code @PreAuthorize} against {@code clubId} — not a bare role check — so swapping in
 * {@link com.cricketlegend.config.AccessService}'s future real {@code RoleAssignment} resolution
 * later is a one-line change, not a rewrite (docs/plans/012-club-profile.md's Flag #2).
 */
@RestController
public class ClubProfileController {

    private final ClubProfileService clubProfileService;

    public ClubProfileController(ClubProfileService clubProfileService) {
        this.clubProfileService = clubProfileService;
    }

    @GetMapping("/api/v1/platform/clubs/{id}/profile")
    public ResponseEntity<ClubProfileDto> get(@PathVariable UUID id) {
        return ResponseEntity.ok(clubProfileService.get(id));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #id)")
    @PutMapping("/api/v1/platform/clubs/{id}/profile")
    public ResponseEntity<ClubProfileDto> upsert(
            @PathVariable UUID id, @Valid @RequestBody UpdateClubProfileRequest request) {
        return ResponseEntity.ok(clubProfileService.upsert(id, request));
    }
}
