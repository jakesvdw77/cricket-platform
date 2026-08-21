package com.cricketlegend.controller;

import com.cricketlegend.dto.MeAccessDto;
import com.cricketlegend.service.MeService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Per docs/specs/016-keycloak-account-provisioning.md. Falls under SecurityConfig's existing
 * {@code .anyRequest().authenticated()} catch-all — no {@code @PreAuthorize}, no SecurityConfig
 * change needed.
 */
@RestController
@RequestMapping("/api/v1/me")
class MeController {

    private final MeService meService;

    MeController(MeService meService) {
        this.meService = meService;
    }

    @PostMapping("/activate")
    MeAccessDto activate(Authentication authentication, @AuthenticationPrincipal Jwt jwt) {
        return meService.activateAndResolveAccess(authentication, jwt);
    }
}
