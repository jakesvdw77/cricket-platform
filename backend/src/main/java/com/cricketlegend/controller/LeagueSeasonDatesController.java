package com.cricketlegend.controller;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.dto.LeagueSeasonDatesDto;
import com.cricketlegend.dto.UpdateLeagueSeasonDatesRequest;
import com.cricketlegend.service.LeagueSeasonDatesService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/111-league-season-dates.md: the start and end date of a club's league in a season, on {@code
 * /api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/dates}. Same access rule as the league's playing
 * conditions.
 */
@RestController
public class LeagueSeasonDatesController {

    private final LeagueSeasonDatesService leagueSeasonDatesService;
    private final AccessService accessService;

    public LeagueSeasonDatesController(LeagueSeasonDatesService leagueSeasonDatesService, AccessService accessService) {
        this.leagueSeasonDatesService = leagueSeasonDatesService;
        this.accessService = accessService;
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/dates")
    public ResponseEntity<LeagueSeasonDatesDto> get(
            @PathVariable UUID clubId, @PathVariable UUID leagueId, @PathVariable UUID seasonId) {
        return ResponseEntity.ok(leagueSeasonDatesService.get(clubId, leagueId, seasonId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/dates")
    public ResponseEntity<LeagueSeasonDatesDto> update(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID leagueId,
            @PathVariable UUID seasonId,
            @Valid @RequestBody UpdateLeagueSeasonDatesRequest request) {
        UUID updatedBy = accessService.resolveCurrentPersonId(authentication);
        return ResponseEntity.ok(leagueSeasonDatesService.update(clubId, leagueId, seasonId, request, updatedBy));
    }
}
