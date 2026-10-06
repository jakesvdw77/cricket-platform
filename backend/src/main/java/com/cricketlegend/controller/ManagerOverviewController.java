package com.cricketlegend.controller;

import com.cricketlegend.dto.ManagerOverviewDto;
import com.cricketlegend.service.ManagerOverviewService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/** docs/specs/079-manager-shell-and-overview.md: the manager overview dashboard. */
@RestController
public class ManagerOverviewController {

    private final ManagerOverviewService managerOverviewService;

    public ManagerOverviewController(ManagerOverviewService managerOverviewService) {
        this.managerOverviewService = managerOverviewService;
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/overview")
    public ResponseEntity<ManagerOverviewDto> overview(Authentication authentication, @PathVariable UUID clubId) {
        return ResponseEntity.ok(managerOverviewService.overview(authentication, clubId));
    }
}
