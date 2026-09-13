package com.cricketlegend.controller;

import com.cricketlegend.dto.TeamSquadMemberDto;
import com.cricketlegend.dto.UpdateTeamSquadMemberJerseyNumberRequest;
import com.cricketlegend.service.TeamSquadService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/029-league-management.md: a {@code Team}'s squad for a given {@code Season} —
 * season-scoped per this spec's own pre-build amendment, nested off {@code clubId} + {@code
 * teamId} + {@code seasonId} on {@code
 * /api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad}. Returns {@link
 * TeamSquadMemberDto}, per docs/specs/031-jersey-numbers.md, which also adds {@link #update} —
 * this join row's first-ever mutation endpoint (its {@code jerseyNumber} only).
 */
@RestController
public class TeamSquadController {

    private final TeamSquadService teamSquadService;

    public TeamSquadController(TeamSquadService teamSquadService) {
        this.teamSquadService = teamSquadService;
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad")
    public ResponseEntity<List<TeamSquadMemberDto>> list(
            @PathVariable UUID clubId, @PathVariable UUID teamId, @PathVariable UUID seasonId) {
        return ResponseEntity.ok(teamSquadService.list(clubId, teamId, seasonId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add")
    public ResponseEntity<TeamSquadMemberDto> add(
            @PathVariable UUID clubId,
            @PathVariable UUID teamId,
            @PathVariable UUID seasonId,
            @PathVariable UUID playerId) {
        return ResponseEntity.ok(teamSquadService.add(clubId, teamId, seasonId, playerId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}")
    public ResponseEntity<TeamSquadMemberDto> update(
            @PathVariable UUID clubId,
            @PathVariable UUID teamId,
            @PathVariable UUID seasonId,
            @PathVariable UUID playerId,
            @Valid @RequestBody UpdateTeamSquadMemberJerseyNumberRequest request) {
        return ResponseEntity.ok(
                teamSquadService.update(clubId, teamId, seasonId, playerId, request.jerseyNumber()));
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
