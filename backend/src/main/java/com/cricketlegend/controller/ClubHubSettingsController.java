package com.cricketlegend.controller;

import com.cricketlegend.dto.ClubHubSettingsDto;
import com.cricketlegend.service.ClubHubSettingsService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/148-player-hub-club-info.md: what the club shows on the Player Hub Club info page. Club administrators
 * only ({@code canAdministerClub}), because switching the directory on publishes people's contact details.
 */
@RestController
public class ClubHubSettingsController {

    private final ClubHubSettingsService clubHubSettingsService;

    public ClubHubSettingsController(ClubHubSettingsService clubHubSettingsService) {
        this.clubHubSettingsService = clubHubSettingsService;
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/hub-settings")
    public ResponseEntity<ClubHubSettingsDto> getHubSettings(@PathVariable UUID clubId) {
        return ResponseEntity.ok(clubHubSettingsService.get(clubId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/hub-settings")
    public ResponseEntity<ClubHubSettingsDto> updateHubSettings(
            @PathVariable UUID clubId, @RequestBody ClubHubSettingsDto request) {
        return ResponseEntity.ok(clubHubSettingsService.put(clubId, request));
    }
}
