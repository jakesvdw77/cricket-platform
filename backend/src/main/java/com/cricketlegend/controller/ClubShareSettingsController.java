package com.cricketlegend.controller;

import com.cricketlegend.dto.ShareSettingsDto;
import com.cricketlegend.service.ClubShareSettingsService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/114-share-result.md: the club's result sharing settings. Any club manager, including a section-scoped
 * one, may read and change them ({@code canAccessClub}), because the setting is only a default shown on the share
 * dialog.
 */
@RestController
public class ClubShareSettingsController {

    private final ClubShareSettingsService clubShareSettingsService;

    public ClubShareSettingsController(ClubShareSettingsService clubShareSettingsService) {
        this.clubShareSettingsService = clubShareSettingsService;
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/share-settings")
    public ResponseEntity<ShareSettingsDto> getShareSettings(@PathVariable UUID clubId) {
        return ResponseEntity.ok(clubShareSettingsService.get(clubId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/share-settings")
    public ResponseEntity<ShareSettingsDto> updateShareSettings(
            @PathVariable UUID clubId, @RequestBody ShareSettingsDto request) {
        return ResponseEntity.ok(clubShareSettingsService.put(clubId, request));
    }
}
