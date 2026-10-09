package com.cricketlegend.controller;

import com.cricketlegend.dto.TeamSelectionOverviewDto;
import com.cricketlegend.service.TeamSelectionService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/093-team-selection-hub.md: the one read behind the Team selection hub on {@code
 * /api/v1/manage/clubs/{clubId}/team-selection}. Section scope is enforced inside the service, like
 * the player availability grid; picking and unpicking use the spec 076 endpoints.
 */
@RestController
public class TeamSelectionController {

    private final TeamSelectionService teamSelectionService;

    public TeamSelectionController(TeamSelectionService teamSelectionService) {
        this.teamSelectionService = teamSelectionService;
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/team-selection")
    public ResponseEntity<TeamSelectionOverviewDto> overview(
            Authentication authentication,
            @PathVariable UUID clubId,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID sectionId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(defaultValue = "false") boolean includePast) {
        return ResponseEntity.ok(teamSelectionService.overview(
                authentication, clubId, seasonId, leagueId, sectionId, teamId, includePast));
    }
}
