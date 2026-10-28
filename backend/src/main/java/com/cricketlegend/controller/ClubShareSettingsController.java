package com.cricketlegend.controller;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.dto.ShareSettingsDto;
import com.cricketlegend.service.ClubShareSettingsService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/114-share-result.md: the club's result sharing settings. Any club manager, including a section-scoped
 * one, may read and change them ({@code canAccessClub}), because the setting is only a default shown on the share
 * dialog. The enabled-formats part ({@code disabledFormats}, docs/specs/122-league-sharing.md) is club-administrator
 * only: the service refuses a changed value unless {@code canAdministerClub} holds.
 */
@RestController
public class ClubShareSettingsController {

    private final ClubShareSettingsService clubShareSettingsService;

    private final AccessService accessService;

    public ClubShareSettingsController(
            ClubShareSettingsService clubShareSettingsService, AccessService accessService) {
        this.clubShareSettingsService = clubShareSettingsService;
        this.accessService = accessService;
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/share-settings")
    public ResponseEntity<ShareSettingsDto> getShareSettings(@PathVariable UUID clubId) {
        return ResponseEntity.ok(clubShareSettingsService.get(clubId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/share-settings")
    public ResponseEntity<ShareSettingsDto> updateShareSettings(
            @PathVariable UUID clubId, @RequestBody ShareSettingsDto request, Authentication authentication) {
        return ResponseEntity.ok(clubShareSettingsService.put(
                clubId, request, accessService.canAdministerClub(authentication, clubId)));
    }
}
