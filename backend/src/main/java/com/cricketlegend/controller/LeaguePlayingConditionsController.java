package com.cricketlegend.controller;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.dto.LeaguePlayingConditionsDto;
import com.cricketlegend.service.LeaguePlayingConditionsService;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * docs/specs/050-league-schedule-and-fixtures.md: the current Playing Conditions PDF document for
 * a club's own {@code League}+{@code Season}, on {@code /api/v1/manage/clubs/{clubId}/leagues/
 * {leagueId}/seasons/{seasonId}/playing-conditions} — a separate controller from {@code
 * LeagueController}, since this endpoint's multipart/file-upload shape is structurally different
 * from every other JSON-body endpoint there. Both endpoints carry the same {@code
 * canAdministerClub} check every other League-nested endpoint uses; {@code NotFoundException}
 * (leagueId/seasonId cross-club, or nothing uploaded yet for GET) maps to 404 globally via {@code
 * GlobalExceptionHandler}, not a per-controller try/catch, matching every other controller in this
 * codebase.
 */
@RestController
public class LeaguePlayingConditionsController {

    private final LeaguePlayingConditionsService leaguePlayingConditionsService;
    private final AccessService accessService;

    public LeaguePlayingConditionsController(
            LeaguePlayingConditionsService leaguePlayingConditionsService, AccessService accessService) {
        this.leaguePlayingConditionsService = leaguePlayingConditionsService;
        this.accessService = accessService;
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playing-conditions")
    public ResponseEntity<LeaguePlayingConditionsDto> get(
            @PathVariable UUID clubId, @PathVariable UUID leagueId, @PathVariable UUID seasonId) {
        return ResponseEntity.ok(leaguePlayingConditionsService.get(clubId, leagueId, seasonId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping(
            value = "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playing-conditions",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<LeaguePlayingConditionsDto> upload(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID leagueId,
            @PathVariable UUID seasonId,
            @RequestParam("file") MultipartFile file) {
        UUID uploadedBy = accessService.resolveCurrentPersonId(authentication);
        return ResponseEntity.ok(
                leaguePlayingConditionsService.upload(clubId, leagueId, seasonId, file, uploadedBy));
    }
}
