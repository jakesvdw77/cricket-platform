package com.cricketlegend.controller;

import com.cricketlegend.dto.MatchSquadDto;
import com.cricketlegend.dto.MatchSquadMemberDto;
import com.cricketlegend.dto.UpdateMatchSquadJerseyNumberRequest;
import com.cricketlegend.service.MatchSquadService;
import jakarta.validation.Valid;
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
 * docs/specs/063-section-availability-and-flexible-squads.md: the per-fixture squad pool for a
 * group-poll-covered match of a {@code Team}, on {@code
 * /api/v1/manage/clubs/{clubId}/matches/{matchId}/teams/{teamId}/squad}, mirroring {@link
 * TeamSquadController}'s exact shape. {@code @PreAuthorize} here is the broad {@code
 * canAccessClub} gate — the actual section-scoped check happens in the service layer, since a
 * single team (and therefore a single section) is always known here.
 */
@RestController
public class MatchSquadController {

    private final MatchSquadService matchSquadService;

    public MatchSquadController(MatchSquadService matchSquadService) {
        this.matchSquadService = matchSquadService;
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/teams/{teamId}/squad")
    public ResponseEntity<MatchSquadDto> get(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @PathVariable UUID teamId) {
        return ResponseEntity.ok(matchSquadService.get(authentication, clubId, matchId, teamId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/teams/{teamId}/squad/{playerId}/add")
    public ResponseEntity<MatchSquadMemberDto> add(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @PathVariable UUID teamId,
            @PathVariable UUID playerId) {
        return ResponseEntity.ok(matchSquadService.add(authentication, clubId, matchId, teamId, playerId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/teams/{teamId}/squad/{playerId}/remove")
    public ResponseEntity<Void> remove(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @PathVariable UUID teamId,
            @PathVariable UUID playerId) {
        matchSquadService.remove(authentication, clubId, matchId, teamId, playerId);
        return ResponseEntity.ok().build();
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/teams/{teamId}/squad/{playerId}")
    public ResponseEntity<MatchSquadMemberDto> updateJerseyNumber(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @PathVariable UUID teamId,
            @PathVariable UUID playerId,
            @Valid @RequestBody UpdateMatchSquadJerseyNumberRequest request) {
        return ResponseEntity.ok(matchSquadService.updateJerseyNumber(
                authentication, clubId, matchId, teamId, playerId, request.jerseyNumber()));
    }
}
