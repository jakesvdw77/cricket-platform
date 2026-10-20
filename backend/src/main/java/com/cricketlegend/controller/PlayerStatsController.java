package com.cricketlegend.controller;

import com.cricketlegend.dto.PlayerStatsDto;
import com.cricketlegend.dto.PlayerStatsFilterOptionsDto;
import com.cricketlegend.service.PlayerStatsService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/103-player-stats.md: a player's statistics from published results. Any club manager
 * ({@code canAccessClub}); a section-scoped manager is narrowed to their sections inside the service.
 */
@RestController
public class PlayerStatsController {

    private final PlayerStatsService playerStatsService;

    public PlayerStatsController(PlayerStatsService playerStatsService) {
        this.playerStatsService = playerStatsService;
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/players/{playerId}/stats")
    public ResponseEntity<PlayerStatsDto> get(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID playerId,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) UUID sectionId,
            @RequestParam(required = false) String competition) {
        return ResponseEntity.ok(playerStatsService.get(
                authentication, clubId, playerId, seasonId, leagueId, teamId, sectionId, competition));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/players/{playerId}/stats/filter-options")
    public ResponseEntity<PlayerStatsFilterOptionsDto> getPlayerStatsFilterOptions(
            Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID playerId) {
        return ResponseEntity.ok(playerStatsService.filterOptions(authentication, clubId, playerId));
    }
}
