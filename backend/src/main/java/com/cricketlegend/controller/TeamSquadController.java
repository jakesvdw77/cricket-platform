package com.cricketlegend.controller;

import com.cricketlegend.dto.PlayerDto;
import com.cricketlegend.service.TeamSquadService;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/029-league-management.md: a {@code Team}'s squad for a given {@code Season} —
 * season-scoped per this spec's own pre-build amendment, nested off {@code clubId} + {@code
 * teamId} + {@code seasonId} on {@code
 * /api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad}. Reuses {@code 028}'s
 * existing {@link PlayerDto} — no new DTO.
 */
@RestController
public class TeamSquadController {

    private final TeamSquadService teamSquadService;

    public TeamSquadController(TeamSquadService teamSquadService) {
        this.teamSquadService = teamSquadService;
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad")
    public ResponseEntity<List<PlayerDto>> list(
            @PathVariable UUID clubId, @PathVariable UUID teamId, @PathVariable UUID seasonId) {
        return ResponseEntity.ok(teamSquadService.list(clubId, teamId, seasonId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add")
    public ResponseEntity<PlayerDto> add(
            @PathVariable UUID clubId,
            @PathVariable UUID teamId,
            @PathVariable UUID seasonId,
            @PathVariable UUID playerId) {
        return ResponseEntity.ok(teamSquadService.add(clubId, teamId, seasonId, playerId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/remove")
    public ResponseEntity<Void> remove(
            @PathVariable UUID clubId,
            @PathVariable UUID teamId,
            @PathVariable UUID seasonId,
            @PathVariable UUID playerId) {
        teamSquadService.remove(clubId, teamId, seasonId, playerId);
        return ResponseEntity.ok().build();
    }
}
