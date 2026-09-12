package com.cricketlegend.controller;

import com.cricketlegend.dto.CreateLeagueAffiliationRequest;
import com.cricketlegend.dto.CreateLeagueRequest;
import com.cricketlegend.dto.LeagueAffiliationDto;
import com.cricketlegend.dto.LeagueDto;
import com.cricketlegend.dto.UpdateLeagueRequest;
import com.cricketlegend.service.LeagueAffiliationService;
import com.cricketlegend.service.LeagueService;
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
 * {@code League} rows, plus affiliations nested under a league, on {@code
 * /api/v1/manage/clubs/{clubId}/leagues} only — no {@code /platform} mirror ({@code
 * canAdministerClub} already gives a {@code platform_admin} superset access on {@code
 * /manage/**}). {@code /api/v1/manage/**} is only {@code authenticated()} at the URL level, so
 * every endpoint here carries its own real {@code @PreAuthorize}.
 */
@RestController
public class LeagueController {

    private final LeagueService leagueService;
    private final LeagueAffiliationService leagueAffiliationService;

    public LeagueController(
            LeagueService leagueService, LeagueAffiliationService leagueAffiliationService) {
        this.leagueService = leagueService;
        this.leagueAffiliationService = leagueAffiliationService;
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/leagues")
    public ResponseEntity<List<LeagueDto>> list(@PathVariable UUID clubId) {
        return ResponseEntity.ok(leagueService.list(clubId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/leagues")
    @ApiResponse(responseCode = "201", description = "League created")
    public ResponseEntity<LeagueDto> create(
            @PathVariable UUID clubId, @Valid @RequestBody CreateLeagueRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(leagueService.create(clubId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/leagues/{leagueId}")
    public ResponseEntity<LeagueDto> update(
            @PathVariable UUID clubId,
            @PathVariable UUID leagueId,
            @Valid @RequestBody UpdateLeagueRequest request) {
        return ResponseEntity.ok(leagueService.update(clubId, leagueId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/deactivate")
    public ResponseEntity<LeagueDto> deactivate(
            @PathVariable UUID clubId, @PathVariable UUID leagueId) {
        return ResponseEntity.ok(leagueService.deactivate(clubId, leagueId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/reactivate")
    public ResponseEntity<LeagueDto> reactivate(
            @PathVariable UUID clubId, @PathVariable UUID leagueId) {
        return ResponseEntity.ok(leagueService.reactivate(clubId, leagueId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/affiliations")
    public ResponseEntity<List<LeagueAffiliationDto>> listAffiliations(
            @PathVariable UUID clubId, @PathVariable UUID leagueId) {
        return ResponseEntity.ok(leagueAffiliationService.list(clubId, leagueId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/affiliations")
    @ApiResponse(responseCode = "201", description = "League affiliation created")
    public ResponseEntity<LeagueAffiliationDto> createAffiliation(
            @PathVariable UUID clubId,
            @PathVariable UUID leagueId,
            @Valid @RequestBody CreateLeagueAffiliationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(leagueAffiliationService.create(clubId, leagueId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/affiliations/{affiliationId}/unaffiliate")
    public ResponseEntity<Void> unaffiliate(
            @PathVariable UUID clubId, @PathVariable UUID leagueId, @PathVariable UUID affiliationId) {
        leagueAffiliationService.unaffiliate(clubId, leagueId, affiliationId);
        return ResponseEntity.ok().build();
    }
}
