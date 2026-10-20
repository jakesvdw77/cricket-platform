package com.cricketlegend.controller;

import com.cricketlegend.dto.LeaderboardSettingsDto;
import com.cricketlegend.service.ClubLeaderboardSettingsService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/103-player-stats.md, decision 18: the club's leaderboard settings (which award categories the Awards view
 * shows). Any club manager, including a section-scoped one, may read and change them ({@code canAccessClub}), like the
 * share settings of spec 114.
 */
@RestController
public class ClubLeaderboardSettingsController {

    private final ClubLeaderboardSettingsService clubLeaderboardSettingsService;

    public ClubLeaderboardSettingsController(ClubLeaderboardSettingsService clubLeaderboardSettingsService) {
        this.clubLeaderboardSettingsService = clubLeaderboardSettingsService;
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/leaderboard-settings")
    public ResponseEntity<LeaderboardSettingsDto> getLeaderboardSettings(@PathVariable UUID clubId) {
        return ResponseEntity.ok(clubLeaderboardSettingsService.get(clubId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/leaderboard-settings")
    public ResponseEntity<LeaderboardSettingsDto> updateLeaderboardSettings(
            @PathVariable UUID clubId, @RequestBody LeaderboardSettingsDto request) {
        return ResponseEntity.ok(clubLeaderboardSettingsService.put(clubId, request));
    }
}
