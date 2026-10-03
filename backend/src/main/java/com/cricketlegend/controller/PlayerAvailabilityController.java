package com.cricketlegend.controller;

import com.cricketlegend.dto.PlayerAvailabilityDto;
import com.cricketlegend.service.PlayerAvailabilityService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/068-player-availability-grid.md: the season-at-a-glance player availability grid on
 * {@code /api/v1/manage/clubs/{clubId}/player-availability}. Section scope is enforced inside the
 * service, exactly like {@code GET .../availability-polls/open} (docs/specs/035).
 */
@RestController
public class PlayerAvailabilityController {

    private final PlayerAvailabilityService playerAvailabilityService;

    public PlayerAvailabilityController(PlayerAvailabilityService playerAvailabilityService) {
        this.playerAvailabilityService = playerAvailabilityService;
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/player-availability")
    public ResponseEntity<PlayerAvailabilityDto> listPlayerAvailability(
            Authentication authentication,
            @PathVariable UUID clubId,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID sectionId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(defaultValue = "false") boolean includePast) {
        return ResponseEntity.ok(playerAvailabilityService.getGrid(
                authentication, clubId, seasonId, leagueId, sectionId, teamId, includePast));
    }
}
