package com.cricketlegend.controller;

import com.cricketlegend.dto.ConfirmLinksRequest;
import com.cricketlegend.dto.ConfirmLinksResultDto;
import com.cricketlegend.dto.PlayerMatchesDto;
import com.cricketlegend.service.LinkService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** docs/specs/119: the email match and confirm step. Any authenticated caller with a verified email; no club scope. */
@RestController
@RequestMapping("/api/v1/me")
class MeLinksController {

    private final LinkService linkService;

    MeLinksController(LinkService linkService) {
        this.linkService = linkService;
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
