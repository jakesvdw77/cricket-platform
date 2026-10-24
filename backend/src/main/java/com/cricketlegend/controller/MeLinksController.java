package com.cricketlegend.controller;

import com.cricketlegend.dto.ConfirmLinksRequest;
import com.cricketlegend.dto.ConfirmLinksResultDto;
import com.cricketlegend.dto.InvitationDto;
import com.cricketlegend.dto.PlayerMatchesDto;
import com.cricketlegend.service.AgentInvitationService;
import com.cricketlegend.service.LinkService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** docs/specs/119: the email match and confirm step. Any authenticated caller with a verified email; no club scope. */
@RestController
@RequestMapping("/api/v1/me")
class MeLinksController {

    private final LinkService linkService;
    private final AgentInvitationService agentInvitationService;

    MeLinksController(LinkService linkService, AgentInvitationService agentInvitationService) {
        this.linkService = linkService;
        this.agentInvitationService = agentInvitationService;
    }

    @GetMapping("/invitations")
    List<InvitationDto> invitations(Authentication authentication, @AuthenticationPrincipal Jwt jwt) {
        return agentInvitationService.invitations(authentication, jwt);
    }

    @PostMapping("/links/{linkId}/accept")
    ResponseEntity<Void> accept(Authentication authentication, @AuthenticationPrincipal Jwt jwt, @PathVariable UUID linkId) {
        agentInvitationService.accept(authentication, jwt, linkId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/links/{linkId}/decline")
    ResponseEntity<Void> decline(Authentication authentication, @AuthenticationPrincipal Jwt jwt, @PathVariable UUID linkId) {
        agentInvitationService.decline(authentication, jwt, linkId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/links/{linkId}")
    ResponseEntity<Void> remove(Authentication authentication, @PathVariable UUID linkId) {
        agentInvitationService.remove(authentication, linkId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/player-matches")
    PlayerMatchesDto playerMatches(Authentication authentication, @AuthenticationPrincipal Jwt jwt) {
        return linkService.matches(authentication, jwt);
    }

    @PostMapping("/links")
    ConfirmLinksResultDto confirmLinks(
            Authentication authentication, @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ConfirmLinksRequest request) {
        return linkService.confirm(authentication, jwt, request);
    }
}
