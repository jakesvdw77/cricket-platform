package com.cricketlegend.controller;

import com.cricketlegend.dto.ApproveLinkRequestRequest;
import com.cricketlegend.dto.DeclineLinkRequestRequest;
import com.cricketlegend.dto.LinkRequestDto;
import com.cricketlegend.dto.LinkRequestSummaryDto;
import com.cricketlegend.service.LinkRequestManagementService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/119: the manager's link request queue (Access, Player accounts). {@code canAccessClub} is the entry gate; the
 * section rule (a section-scoped manager decides only requests in their sections) is enforced by the service.
 */
@RestController
public class LinkRequestManagementController {

    private final LinkRequestManagementService linkRequestManagementService;

    public LinkRequestManagementController(LinkRequestManagementService linkRequestManagementService) {
        this.linkRequestManagementService = linkRequestManagementService;
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/link-requests")
    public ResponseEntity<List<LinkRequestDto>> list(Authentication authentication, @PathVariable UUID clubId) {
        return ResponseEntity.ok(linkRequestManagementService.list(authentication, clubId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/link-requests/summary")
    public ResponseEntity<LinkRequestSummaryDto> summary(Authentication authentication, @PathVariable UUID clubId) {
        return ResponseEntity.ok(linkRequestManagementService.summary(authentication, clubId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/link-requests/{requestId}/approve")
    public ResponseEntity<Void> approve(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID requestId,
            @Valid @RequestBody ApproveLinkRequestRequest request) {
        linkRequestManagementService.approve(authentication, clubId, requestId, request);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/link-requests/{requestId}/decline")
    public ResponseEntity<Void> decline(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID requestId,
            @Valid @RequestBody(required = false) DeclineLinkRequestRequest request) {
        linkRequestManagementService.decline(authentication, clubId, requestId, request);
        return ResponseEntity.noContent().build();
    }
}
