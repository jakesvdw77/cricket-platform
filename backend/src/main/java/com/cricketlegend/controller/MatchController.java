package com.cricketlegend.controller;

import com.cricketlegend.dto.CreateMatchRequest;
import com.cricketlegend.dto.MatchDto;
import com.cricketlegend.dto.UpdateMatchRequest;
import com.cricketlegend.service.MatchService;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/029-league-management.md: list (paginated — the first {@code Pageable} endpoint in
 * this feature area)/get/create/update/deactivate/reactivate for a club's own scheduled {@code
 * Match} rows, on {@code /api/v1/manage/clubs/{clubId}/matches}.
 */
@RestController
public class MatchController {

    private final MatchService matchService;

    public MatchController(MatchService matchService) {
        this.matchService = matchService;
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/matches")
    public ResponseEntity<Page<MatchDto>> list(@PathVariable UUID clubId, Pageable pageable) {
        return ResponseEntity.ok(matchService.list(clubId, pageable));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}")
    public ResponseEntity<MatchDto> get(@PathVariable UUID clubId, @PathVariable UUID matchId) {
        return ResponseEntity.ok(matchService.get(clubId, matchId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/matches")
    @ApiResponse(responseCode = "201", description = "Match created")
    public ResponseEntity<MatchDto> create(
            @PathVariable UUID clubId, @Valid @RequestBody CreateMatchRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(matchService.create(clubId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}")
    public ResponseEntity<MatchDto> update(
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @Valid @RequestBody UpdateMatchRequest request) {
        return ResponseEntity.ok(matchService.update(clubId, matchId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/deactivate")
    public ResponseEntity<MatchDto> deactivate(
            @PathVariable UUID clubId, @PathVariable UUID matchId) {
        return ResponseEntity.ok(matchService.deactivate(clubId, matchId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/reactivate")
    public ResponseEntity<MatchDto> reactivate(
            @PathVariable UUID clubId, @PathVariable UUID matchId) {
        return ResponseEntity.ok(matchService.reactivate(clubId, matchId));
    }
}
