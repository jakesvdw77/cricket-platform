package com.cricketlegend.controller;

import com.cricketlegend.dto.CreateSeasonRequest;
import com.cricketlegend.dto.SeasonDto;
import com.cricketlegend.dto.UpdateSeasonRequest;
import com.cricketlegend.service.SeasonService;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
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
 * docs/specs/029-league-management.md: list/create/update/deactivate/reactivate for a club's own
 * {@code Season} rows, on {@code /api/v1/manage/clubs/{clubId}/seasons} only.
 */
@RestController
public class SeasonController {

    private final SeasonService seasonService;

    public SeasonController(SeasonService seasonService) {
        this.seasonService = seasonService;
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/seasons")
    public ResponseEntity<List<SeasonDto>> list(@PathVariable UUID clubId) {
        return ResponseEntity.ok(seasonService.list(clubId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/seasons")
    @ApiResponse(responseCode = "201", description = "Season created")
    public ResponseEntity<SeasonDto> create(
            @PathVariable UUID clubId, @Valid @RequestBody CreateSeasonRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(seasonService.create(clubId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/seasons/{seasonId}")
    public ResponseEntity<SeasonDto> update(
            @PathVariable UUID clubId,
            @PathVariable UUID seasonId,
            @Valid @RequestBody UpdateSeasonRequest request) {
        return ResponseEntity.ok(seasonService.update(clubId, seasonId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/seasons/{seasonId}/deactivate")
    public ResponseEntity<SeasonDto> deactivate(
            @PathVariable UUID clubId, @PathVariable UUID seasonId) {
        return ResponseEntity.ok(seasonService.deactivate(clubId, seasonId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/seasons/{seasonId}/reactivate")
    public ResponseEntity<SeasonDto> reactivate(
            @PathVariable UUID clubId, @PathVariable UUID seasonId) {
        return ResponseEntity.ok(seasonService.reactivate(clubId, seasonId));
    }
}
