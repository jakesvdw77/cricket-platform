package com.cricketlegend.controller;

import com.cricketlegend.dto.AccessGrantDto;
import com.cricketlegend.dto.AccessGrantListDto;
import com.cricketlegend.dto.AccessRoleDto;
import com.cricketlegend.dto.AddAccessGrantRequest;
import com.cricketlegend.dto.AddAccessGrantResultDto;
import com.cricketlegend.dto.ChangeAccessGrantRoleRequest;
import com.cricketlegend.service.AccessGrantService;
import com.cricketlegend.service.AccessRoleService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/150-managers-and-access-grants.md: who has which role where. The URL gate is "authenticated" (docs/specs/020); the
 * annotations below are the entry gate and the service re-checks the exact place, so a section grantor never reaches past their
 * own section. Roles are readable by anyone who holds any grant at the club.
 */
@RestController
public class AccessGrantController {

    private static final String VIEW = "@access.can(authentication, #clubId, T(com.cricketlegend.domain.Permission).ACCESS_VIEW)";
    private static final String MANAGE =
            "@access.can(authentication, #clubId, T(com.cricketlegend.domain.Permission).ACCESS_MANAGE)";

    private final AccessGrantService accessGrantService;
    private final AccessRoleService accessRoleService;

    public AccessGrantController(AccessGrantService accessGrantService, AccessRoleService accessRoleService) {
        this.accessGrantService = accessGrantService;
        this.accessRoleService = accessRoleService;
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/access/roles")
    public ResponseEntity<List<AccessRoleDto>> roles(@PathVariable UUID clubId) {
        return ResponseEntity.ok(accessRoleService.list());
    }

    @PreAuthorize(VIEW)
    @GetMapping("/api/v1/manage/clubs/{clubId}/access/grants")
    public ResponseEntity<AccessGrantListDto> list(Authentication authentication, @PathVariable UUID clubId) {
        return ResponseEntity.ok(accessGrantService.list(authentication, clubId));
    }

    @PreAuthorize(MANAGE)
    @PostMapping("/api/v1/manage/clubs/{clubId}/access/grants")
    public ResponseEntity<AddAccessGrantResultDto> add(
            Authentication authentication, @PathVariable UUID clubId, @Valid @RequestBody AddAccessGrantRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(accessGrantService.add(authentication, clubId, request));
    }

    @PreAuthorize(MANAGE)
    @PatchMapping("/api/v1/manage/clubs/{clubId}/access/grants/{grantId}")
    public ResponseEntity<AccessGrantDto> changeRole(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID grantId,
            @Valid @RequestBody ChangeAccessGrantRoleRequest request) {
        return ResponseEntity.ok(accessGrantService.changeRole(authentication, clubId, grantId, request));
    }

    @PreAuthorize(MANAGE)
    @PostMapping("/api/v1/manage/clubs/{clubId}/access/grants/{grantId}/resend")
    public ResponseEntity<Void> resend(Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID grantId) {
        accessGrantService.resend(authentication, clubId, grantId);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize(MANAGE)
    @DeleteMapping("/api/v1/manage/clubs/{clubId}/access/grants/{grantId}")
    public ResponseEntity<Void> remove(Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID grantId) {
        accessGrantService.remove(authentication, clubId, grantId);
        return ResponseEntity.noContent().build();
    }
}
