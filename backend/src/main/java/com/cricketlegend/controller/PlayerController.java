package com.cricketlegend.controller;

import com.cricketlegend.dto.CreatePlayerRequest;
import com.cricketlegend.dto.PlayerDto;
import com.cricketlegend.dto.SectionDto;
import com.cricketlegend.dto.UpdatePlayerRequest;
import com.cricketlegend.domain.PlayerListFocus;
import com.cricketlegend.dto.PlayersSummaryDto;
import com.cricketlegend.service.PlayerSectionService;
import com.cricketlegend.service.PlayerService;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
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
 *
 * <p>Per docs/specs/035-section-scoped-access.md: most endpoints widen from {@code
 * canAdministerClub} to {@code canAccessClub} (a section-scoped caller's own reach enforced
 * inside the service layer); {@link #linkSection}/{@link #unlinkSection} use direct SpEL {@code
 * canAdministerSection} since {@code sectionId} is already a path variable there.
 */
@RestController
public class PlayerController {

    private final PlayerService playerService;
    private final PlayerSectionService playerSectionService;

    public PlayerController(PlayerService playerService, PlayerSectionService playerSectionService) {
        this.playerService = playerService;
        this.playerSectionService = playerSectionService;
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/players")
    public ResponseEntity<List<PlayerDto>> list(
            Authentication authentication,
            @PathVariable UUID clubId,
            @RequestParam(required = false) UUID sectionId,
            @RequestParam(defaultValue = "false") boolean missingDateOfBirth,
            // docs/specs/088: false also hides suspended and rejected players; the default keeps every caller as before
            @RequestParam(defaultValue = "true") boolean includeInactive,
            @RequestParam(required = false) String focus, // in-squad | selected | unverified
            @RequestParam(required = false) UUID seasonId) {
        return ResponseEntity.ok(playerService.list(
                authentication, clubId, sectionId, missingDateOfBirth, includeInactive,
                PlayerListFocus.parse(focus), seasonId));
    }

    /** docs/specs/088-players-polls-alignment.md: the Players page counters for the same filters the list uses. */
    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/players/summary")
    public ResponseEntity<PlayersSummaryDto> summary(
            Authentication authentication,
            @PathVariable UUID clubId,
            @RequestParam(required = false) UUID sectionId,
            @RequestParam(defaultValue = "false") boolean missingDateOfBirth,
            @RequestParam(defaultValue = "true") boolean includeInactive,
            @RequestParam(required = false) UUID seasonId) {
        return ResponseEntity.ok(playerService.summary(
                authentication, clubId, sectionId, missingDateOfBirth, includeInactive, seasonId));
    }

    /** docs/specs/088: accept a player request (or undo a reject). */
    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/players/{playerId}/verify")
    public ResponseEntity<PlayerDto> verify(
            Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID playerId) {
        return ResponseEntity.ok(playerService.verify(authentication, clubId, playerId));
    }

    /** docs/specs/088: reject an unverified player request; the player is kept but hidden. */
    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/players/{playerId}/reject")
    public ResponseEntity<PlayerDto> reject(
            Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID playerId) {
        return ResponseEntity.ok(playerService.reject(authentication, clubId, playerId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/players")
    @ApiResponse(responseCode = "201", description = "Player created")
    public ResponseEntity<PlayerDto> create(
            @PathVariable UUID clubId, @Valid @RequestBody CreatePlayerRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(playerService.create(clubId, request));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/players/{playerId}")
    public ResponseEntity<PlayerDto> update(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID playerId,
            @Valid @RequestBody UpdatePlayerRequest request) {
        return ResponseEntity.ok(playerService.update(authentication, clubId, playerId, request));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/players/{playerId}/deactivate")
    public ResponseEntity<PlayerDto> deactivate(
            Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID playerId) {
        return ResponseEntity.ok(playerService.deactivate(authentication, clubId, playerId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/players/{playerId}/reactivate")
    public ResponseEntity<PlayerDto> reactivate(
            Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID playerId) {
        return ResponseEntity.ok(playerService.reactivate(authentication, clubId, playerId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/players/{playerId}/sections")
    public ResponseEntity<List<SectionDto>> listSections(
            Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID playerId) {
        return ResponseEntity.ok(playerSectionService.list(authentication, clubId, playerId));
    }

    @PreAuthorize("@access.canAdministerSection(authentication, #clubId, #sectionId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/players/{playerId}/sections/{sectionId}/link")
    public ResponseEntity<Void> linkSection(
            @PathVariable UUID clubId, @PathVariable UUID playerId, @PathVariable UUID sectionId) {
        playerSectionService.link(clubId, playerId, sectionId);
        return ResponseEntity.ok().build();
    }

    @PreAuthorize("@access.canAdministerSection(authentication, #clubId, #sectionId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/players/{playerId}/sections/{sectionId}/unlink")
    public ResponseEntity<Void> unlinkSection(
            @PathVariable UUID clubId, @PathVariable UUID playerId, @PathVariable UUID sectionId) {
        playerSectionService.unlink(clubId, playerId, sectionId);
        return ResponseEntity.ok().build();
    }
}
