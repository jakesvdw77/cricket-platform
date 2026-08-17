package com.cricketlegend.controller;

import com.cricketlegend.dto.AdminIdentityDto;
import com.cricketlegend.service.AdminIdentityService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/005-admin-login.md — the authenticated platform admin's identity, read directly from
 * the verified JWT. Gated by SecurityConfig's existing {@code hasRole("platform_admin")} match on
 * {@code /api/v1/platform/**}; no repository or Person lookup involved.
 */
@RestController
public class AdminIdentityController {

    private final AdminIdentityService adminIdentityService;

    public AdminIdentityController(AdminIdentityService adminIdentityService) {
        this.adminIdentityService = adminIdentityService;
    }

    @GetMapping("/api/v1/platform/me")
    public ResponseEntity<AdminIdentityDto> me(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(adminIdentityService.getCurrentAdmin(jwt));
    }
}
