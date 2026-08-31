package com.cricketlegend.controller;

import com.cricketlegend.dto.CreatePlayerRequest;
import com.cricketlegend.dto.PlayerDto;
import com.cricketlegend.dto.SectionDto;
import com.cricketlegend.dto.UpdatePlayerRequest;
import com.cricketlegend.service.PlayerSectionService;
import com.cricketlegend.service.PlayerService;
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
 * docs/specs/028-players.md: list/create/update/deactivate/reactivate for a club's {@code Player}
 * rows, plus section-tagging link/unlink, on {@code
 * /api/v1/manage/clubs/{clubId}/players} only — no {@code /platform} mirror (same established
 * reasoning every spec since {@code 020} has given: {@link
 * com.cricketlegend.config.AccessService#canAdministerClub} already gives a {@code
 * platform_admin} superset access on {@code /manage/**}). {@code /api/v1/manage/**} is only
 * {@code authenticated()} at the URL level ({@link com.cricketlegend.config.SecurityConfig}), so
 * every endpoint here carries its own real {@code @PreAuthorize} — no exceptions.
 *
 * <p>{@link PlayerSectionService}'s endpoints live on this same controller (per
 * docs/plans/028-players.md), matching {@code TeamController}'s precedent of hosting a join's
 * endpoints alongside its parent's.
 */
@RestController
public class PlayerController {

    private final PlayerService playerService;
    private final PlayerSectionService playerSectionService;

    public PlayerController(PlayerService playerService, PlayerSectionService playerSectionService) {
        this.playerService = playerService;
        this.playerSectionService = playerSectionService;
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/players")
    public ResponseEntity<List<PlayerDto>> list(@PathVariable UUID clubId) {
        return ResponseEntity.ok(playerService.list(clubId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/players")
    @ApiResponse(responseCode = "201", description = "Player created")
    public ResponseEntity<PlayerDto> create(
            @PathVariable UUID clubId, @Valid @RequestBody CreatePlayerRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(playerService.create(clubId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/players/{playerId}")
    public ResponseEntity<PlayerDto> update(
            @PathVariable UUID clubId,
            @PathVariable UUID playerId,
            @Valid @RequestBody UpdatePlayerRequest request) {
        return ResponseEntity.ok(playerService.update(clubId, playerId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/players/{playerId}/deactivate")
    public ResponseEntity<PlayerDto> deactivate(@PathVariable UUID clubId, @PathVariable UUID playerId) {
        return ResponseEntity.ok(playerService.deactivate(clubId, playerId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/players/{playerId}/reactivate")
    public ResponseEntity<PlayerDto> reactivate(@PathVariable UUID clubId, @PathVariable UUID playerId) {
        return ResponseEntity.ok(playerService.reactivate(clubId, playerId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/players/{playerId}/sections")
    public ResponseEntity<List<SectionDto>> listSections(
            @PathVariable UUID clubId, @PathVariable UUID playerId) {
        return ResponseEntity.ok(playerSectionService.list(clubId, playerId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/players/{playerId}/sections/{sectionId}/link")
    public ResponseEntity<Void> linkSection(
            @PathVariable UUID clubId, @PathVariable UUID playerId, @PathVariable UUID sectionId) {
        playerSectionService.link(clubId, playerId, sectionId);
        return ResponseEntity.ok().build();
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/players/{playerId}/sections/{sectionId}/unlink")
    public ResponseEntity<Void> unlinkSection(
            @PathVariable UUID clubId, @PathVariable UUID playerId, @PathVariable UUID sectionId) {
        playerSectionService.unlink(clubId, playerId, sectionId);
        return ResponseEntity.ok().build();
    }
}
