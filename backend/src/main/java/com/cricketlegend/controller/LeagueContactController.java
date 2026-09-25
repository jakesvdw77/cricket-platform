package com.cricketlegend.controller;

import com.cricketlegend.dto.CreateLeagueContactRequest;
import com.cricketlegend.dto.LeagueContactDto;
import com.cricketlegend.dto.UpdateLeagueContactRequest;
import com.cricketlegend.service.LeagueContactService;
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
 * docs/specs/054-league-contacts.md: list/create/update/deactivate/reactivate for a league's
 * named contacts, on {@code /api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts} only —
 * no {@code /platform} mirror (see the spec's API Contract Architecture note: {@link
 * com.cricketlegend.config.AccessService#canAdministerClub} already gives a {@code
 * platform_admin} superset access on {@code /manage/**}). {@code /api/v1/manage/**} is only
 * {@code authenticated()} at the URL level ({@link com.cricketlegend.config.SecurityConfig}), so
 * every endpoint here carries its own real {@code @PreAuthorize} — no exceptions.
 */
@RestController
public class LeagueContactController {

    private final LeagueContactService leagueContactService;

    public LeagueContactController(LeagueContactService leagueContactService) {
        this.leagueContactService = leagueContactService;
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts")
    public ResponseEntity<List<LeagueContactDto>> list(
            @PathVariable UUID clubId, @PathVariable UUID leagueId) {
        return ResponseEntity.ok(leagueContactService.list(clubId, leagueId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts")
    @ApiResponse(responseCode = "201", description = "League contact created")
    public ResponseEntity<LeagueContactDto> create(
            @PathVariable UUID clubId,
            @PathVariable UUID leagueId,
            @Valid @RequestBody CreateLeagueContactRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(leagueContactService.create(clubId, leagueId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts/{contactId}")
    public ResponseEntity<LeagueContactDto> update(
            @PathVariable UUID clubId,
            @PathVariable UUID leagueId,
            @PathVariable UUID contactId,
            @Valid @RequestBody UpdateLeagueContactRequest request) {
        return ResponseEntity.ok(leagueContactService.update(clubId, leagueId, contactId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts/{contactId}/deactivate")
    public ResponseEntity<LeagueContactDto> deactivate(
            @PathVariable UUID clubId, @PathVariable UUID leagueId, @PathVariable UUID contactId) {
        return ResponseEntity.ok(leagueContactService.deactivate(clubId, leagueId, contactId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts/{contactId}/reactivate")
    public ResponseEntity<LeagueContactDto> reactivate(
            @PathVariable UUID clubId, @PathVariable UUID leagueId, @PathVariable UUID contactId) {
        return ResponseEntity.ok(leagueContactService.reactivate(clubId, leagueId, contactId));
    }
}
