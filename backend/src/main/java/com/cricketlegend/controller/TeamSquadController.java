package com.cricketlegend.controller;

import com.cricketlegend.dto.TeamSquadMemberDto;
import com.cricketlegend.dto.UpdateTeamSquadMemberRequest;
import com.cricketlegend.service.TeamSquadService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
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
 * this join row's first-ever mutation endpoint (its {@code jerseyNumber} only). Per
 * docs/specs/057-team-extended-profile.md, {@link #update} now takes {@link
 * UpdateTeamSquadMemberRequest} (renamed from {@code UpdateTeamSquadMemberJerseyNumberRequest}),
 * a full-resource replace of both {@code jerseyNumber} and the new {@code isCaptain} flag.
 */
@RestController
public class TeamSquadController {

    private final TeamSquadService teamSquadService;

    public TeamSquadController(TeamSquadService teamSquadService) {
        this.teamSquadService = teamSquadService;
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad")
    public ResponseEntity<List<TeamSquadMemberDto>> list(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID teamId,
            @PathVariable UUID seasonId) {
        return ResponseEntity.ok(teamSquadService.list(authentication, clubId, teamId, seasonId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add")
    public ResponseEntity<TeamSquadMemberDto> add(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID teamId,
            @PathVariable UUID seasonId,
            @PathVariable UUID playerId) {
        return ResponseEntity.ok(teamSquadService.add(authentication, clubId, teamId, seasonId, playerId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}")
    public ResponseEntity<TeamSquadMemberDto> update(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID teamId,
            @PathVariable UUID seasonId,
            @PathVariable UUID playerId,
            @Valid @RequestBody UpdateTeamSquadMemberRequest request) {
        return ResponseEntity.ok(teamSquadService.update(
                authentication, clubId, teamId, seasonId, playerId, request.jerseyNumber(), request.isCaptain()));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/remove")
    public ResponseEntity<Void> remove(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID teamId,
            @PathVariable UUID seasonId,
            @PathVariable UUID playerId) {
        teamSquadService.remove(authentication, clubId, teamId, seasonId, playerId);
        return ResponseEntity.ok().build();
    }
}
