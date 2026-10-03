package com.cricketlegend.controller;

import com.cricketlegend.dto.CopyLeagueTeamsRequest;
import com.cricketlegend.dto.CopyLeagueTeamsResponse;
import com.cricketlegend.dto.CreateLeagueTeamRequest;
import com.cricketlegend.dto.LeagueTeamDto;
import com.cricketlegend.dto.RemoveLeagueTeamResponse;
import com.cricketlegend.dto.UpdateLeagueTeamRequest;
import com.cricketlegend.service.LeagueTeamService;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/070-league-teams.md: a league season's league teams (lightweight opponents a match
 * can pick) on {@code /api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/
 * league-teams}, club admin only ({@code canAdministerClub}, the same check every League-nested
 * endpoint uses). Exceptions map to 400/404/409 globally via {@code GlobalExceptionHandler}.
 */
@RestController
public class LeagueTeamController {

    private static final String BASE =
            "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/league-teams";

    private final LeagueTeamService leagueTeamService;

    public LeagueTeamController(LeagueTeamService leagueTeamService) {
        this.leagueTeamService = leagueTeamService;
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping(BASE)
    public ResponseEntity<List<LeagueTeamDto>> listLeagueTeams(
            @PathVariable UUID clubId,
            @PathVariable UUID leagueId,
            @PathVariable UUID seasonId,
            @RequestParam(defaultValue = "false") boolean activeOnly) {
        return ResponseEntity.ok(leagueTeamService.list(clubId, leagueId, seasonId, activeOnly));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping(BASE)
    @ApiResponse(responseCode = "201", description = "League team created")
    public ResponseEntity<LeagueTeamDto> createLeagueTeam(
            @PathVariable UUID clubId,
            @PathVariable UUID leagueId,
            @PathVariable UUID seasonId,
            @Valid @RequestBody CreateLeagueTeamRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(leagueTeamService.create(clubId, leagueId, seasonId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PutMapping(BASE + "/{leagueTeamId}")
    public ResponseEntity<LeagueTeamDto> updateLeagueTeam(
            @PathVariable UUID clubId,
            @PathVariable UUID leagueId,
            @PathVariable UUID seasonId,
            @PathVariable UUID leagueTeamId,
            @Valid @RequestBody UpdateLeagueTeamRequest request) {
        return ResponseEntity.ok(leagueTeamService.update(clubId, leagueId, seasonId, leagueTeamId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping(BASE + "/{leagueTeamId}/deactivate")
    public ResponseEntity<LeagueTeamDto> deactivateLeagueTeam(
            @PathVariable UUID clubId,
            @PathVariable UUID leagueId,
            @PathVariable UUID seasonId,
            @PathVariable UUID leagueTeamId) {
        return ResponseEntity.ok(leagueTeamService.deactivate(clubId, leagueId, seasonId, leagueTeamId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping(BASE + "/{leagueTeamId}/reactivate")
    public ResponseEntity<LeagueTeamDto> reactivateLeagueTeam(
            @PathVariable UUID clubId,
            @PathVariable UUID leagueId,
            @PathVariable UUID seasonId,
            @PathVariable UUID leagueTeamId) {
        return ResponseEntity.ok(leagueTeamService.reactivate(clubId, leagueId, seasonId, leagueTeamId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping(BASE + "/{leagueTeamId}/remove")
    public ResponseEntity<RemoveLeagueTeamResponse> removeLeagueTeam(
            @PathVariable UUID clubId,
            @PathVariable UUID leagueId,
            @PathVariable UUID seasonId,
            @PathVariable UUID leagueTeamId) {
        return ResponseEntity.ok(leagueTeamService.remove(clubId, leagueId, seasonId, leagueTeamId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping(BASE + "/copy")
    public ResponseEntity<CopyLeagueTeamsResponse> copyLeagueTeams(
            @PathVariable UUID clubId,
            @PathVariable UUID leagueId,
            @PathVariable UUID seasonId,
            @Valid @RequestBody CopyLeagueTeamsRequest request) {
        return ResponseEntity.ok(leagueTeamService.copy(clubId, leagueId, seasonId, request));
    }
}
