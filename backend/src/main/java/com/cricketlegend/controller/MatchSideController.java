package com.cricketlegend.controller;

import com.cricketlegend.dto.AddMatchSidePlayerRequest;
import com.cricketlegend.dto.CreateMatchSideRequest;
import com.cricketlegend.dto.MatchSideDto;
import com.cricketlegend.dto.ReorderMatchSidePlayersRequest;
import com.cricketlegend.dto.UpdateMatchSidePlayerRequest;
import com.cricketlegend.dto.UpdateMatchSideRequest;
import com.cricketlegend.service.MatchSideService;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/029-league-management.md: a {@code Match}'s playing-XI sides, on {@code
 * /api/v1/manage/clubs/{clubId}/matches/{matchId}/sides}.
 */
@RestController
public class MatchSideController {

    private final MatchSideService matchSideService;

    public MatchSideController(MatchSideService matchSideService) {
        this.matchSideService = matchSideService;
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides")
    public ResponseEntity<List<MatchSideDto>> list(
            @PathVariable UUID clubId, @PathVariable UUID matchId) {
        return ResponseEntity.ok(matchSideService.list(clubId, matchId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides")
    @ApiResponse(responseCode = "201", description = "Match side created")
    public ResponseEntity<MatchSideDto> createSide(
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @Valid @RequestBody CreateMatchSideRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(matchSideService.createSide(clubId, matchId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}")
    public ResponseEntity<MatchSideDto> updateSide(
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @PathVariable UUID sideId,
            @Valid @RequestBody UpdateMatchSideRequest request) {
        return ResponseEntity.ok(matchSideService.updateSide(clubId, matchId, sideId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/players")
    @ApiResponse(responseCode = "201", description = "Player added to match side")
    public ResponseEntity<MatchSideDto> addPlayer(
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @PathVariable UUID sideId,
            @Valid @RequestBody AddMatchSidePlayerRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(matchSideService.addPlayer(clubId, matchId, sideId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/players/{playerProfileId}")
    public ResponseEntity<MatchSideDto> updatePlayerRole(
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @PathVariable UUID sideId,
            @PathVariable UUID playerProfileId,
            @Valid @RequestBody UpdateMatchSidePlayerRequest request) {
        return ResponseEntity.ok(
                matchSideService.updatePlayerRole(clubId, matchId, sideId, playerProfileId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping(
            "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/players/{playerProfileId}/remove")
    public ResponseEntity<MatchSideDto> removePlayer(
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @PathVariable UUID sideId,
            @PathVariable UUID playerProfileId) {
        return ResponseEntity.ok(matchSideService.removePlayer(clubId, matchId, sideId, playerProfileId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/players/reorder")
    public ResponseEntity<MatchSideDto> reorderPlayers(
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @PathVariable UUID sideId,
            @Valid @RequestBody ReorderMatchSidePlayersRequest request) {
        return ResponseEntity.ok(matchSideService.reorderPlayers(clubId, matchId, sideId, request));
    }
}
