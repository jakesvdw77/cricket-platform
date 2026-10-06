package com.cricketlegend.controller;

import com.cricketlegend.dto.ApplySelectionRequest;
import com.cricketlegend.dto.MatchSideDto;
import com.cricketlegend.dto.SelectionPoolDto;
import com.cricketlegend.service.MatchSelectionService;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/076-team-selection.md: the selection pool and the atomic apply-selection endpoint of a
 * {@code Match}'s side, under {@code /api/v1/manage/clubs/{clubId}/matches/{matchId}}.
 */
@RestController
public class MatchSelectionController {

    private final MatchSelectionService matchSelectionService;

    public MatchSelectionController(MatchSelectionService matchSelectionService) {
        this.matchSelectionService = matchSelectionService;
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/teams/{teamId}/selection-pool")
    public ResponseEntity<SelectionPoolDto> pool(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @PathVariable UUID teamId,
            @RequestParam(defaultValue = "false") boolean wholeSection,
            @RequestParam(required = false) String q) {
        return ResponseEntity.ok(
                matchSelectionService.pool(authentication, clubId, matchId, teamId, wholeSection, q));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/selection")
    @ApiResponse(responseCode = "409", description = "One or more players cannot be selected; nothing was saved")
    public ResponseEntity<MatchSideDto> apply(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @PathVariable UUID sideId,
            @Valid @RequestBody ApplySelectionRequest request) {
        return ResponseEntity.ok(matchSelectionService.apply(authentication, clubId, matchId, sideId, request));
    }
}
