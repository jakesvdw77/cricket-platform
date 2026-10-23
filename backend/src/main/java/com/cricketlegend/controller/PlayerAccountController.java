package com.cricketlegend.controller;

import com.cricketlegend.dto.ConfirmActionRequest;
import com.cricketlegend.dto.ManagerInviteRequest;
import com.cricketlegend.dto.PlayerAccountDto;
import com.cricketlegend.dto.PlayerLinkDto;
import com.cricketlegend.service.PlayerAccountService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/119: "Players and their main agent" and a player's agents, read only in slice 3. Masked emails only. The
 * section rule is enforced by the service.
 */
@RestController
public class PlayerAccountController {

    private final PlayerAccountService playerAccountService;

    public PlayerAccountController(PlayerAccountService playerAccountService) {
        this.playerAccountService = playerAccountService;
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/player-accounts")
    public ResponseEntity<Page<PlayerAccountDto>> list(
            Authentication authentication,
            @PathVariable UUID clubId,
            @RequestParam(required = false) UUID sectionId,
            @RequestParam(defaultValue = "false") boolean noMainAgent,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(
                playerAccountService.list(authentication, clubId, sectionId, noMainAgent, search, page, size));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/players/{playerId}/links")
    public ResponseEntity<List<PlayerLinkDto>> links(
            Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID playerId) {
        return ResponseEntity.ok(playerAccountService.links(authentication, clubId, playerId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @DeleteMapping("/api/v1/manage/clubs/{clubId}/players/{playerId}/links/{linkId}")
    public ResponseEntity<Void> revokeLink(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID playerId,
            @PathVariable UUID linkId,
            @RequestParam(defaultValue = "false") boolean confirm) {
        playerAccountService.revokeLink(authentication, clubId, playerId, linkId, confirm);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/players/{playerId}/links/{linkId}/make-main")
    public ResponseEntity<Void> makeMain(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID playerId,
            @PathVariable UUID linkId,
            @RequestBody ConfirmActionRequest request) {
        playerAccountService.makeMain(authentication, clubId, playerId, linkId, request.confirm());
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/players/{playerId}/links")
    public ResponseEntity<Void> inviteMain(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID playerId,
            @Valid @RequestBody ManagerInviteRequest request) {
        playerAccountService.inviteMain(authentication, clubId, playerId, request.email(), request.confirm());
        return ResponseEntity.noContent().build();
    }
}
