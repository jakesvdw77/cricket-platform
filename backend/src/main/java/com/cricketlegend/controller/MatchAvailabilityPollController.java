package com.cricketlegend.controller;

import com.cricketlegend.dto.CreateMatchAvailabilityPollRequest;
import com.cricketlegend.dto.MatchAvailabilityPollDto;
import com.cricketlegend.dto.MatchAvailabilityPollResponsesDto;
import com.cricketlegend.dto.SetPlayerAvailabilityRequest;
import com.cricketlegend.service.MatchAvailabilityPollService;
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
 * docs/specs/032-match-availability-polls.md: a {@code Match}'s availability polls, on {@code
 * /api/v1/manage/clubs/{clubId}/matches/{matchId}/polls}.
 */
@RestController
public class MatchAvailabilityPollController {

    private final MatchAvailabilityPollService matchAvailabilityPollService;

    public MatchAvailabilityPollController(MatchAvailabilityPollService matchAvailabilityPollService) {
        this.matchAvailabilityPollService = matchAvailabilityPollService;
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls")
    public ResponseEntity<List<MatchAvailabilityPollDto>> list(
            @PathVariable UUID clubId, @PathVariable UUID matchId) {
        return ResponseEntity.ok(matchAvailabilityPollService.list(clubId, matchId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls")
    @ApiResponse(responseCode = "201", description = "Availability poll created")
    public ResponseEntity<MatchAvailabilityPollDto> create(
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @Valid @RequestBody CreateMatchAvailabilityPollRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(matchAvailabilityPollService.create(clubId, matchId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}/open")
    public ResponseEntity<MatchAvailabilityPollDto> open(
            @PathVariable UUID clubId, @PathVariable UUID matchId, @PathVariable UUID pollId) {
        return ResponseEntity.ok(matchAvailabilityPollService.open(clubId, matchId, pollId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}/close")
    public ResponseEntity<MatchAvailabilityPollDto> close(
            @PathVariable UUID clubId, @PathVariable UUID matchId, @PathVariable UUID pollId) {
        return ResponseEntity.ok(matchAvailabilityPollService.close(clubId, matchId, pollId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}/responses")
    public ResponseEntity<MatchAvailabilityPollResponsesDto> getResponses(
            @PathVariable UUID clubId, @PathVariable UUID matchId, @PathVariable UUID pollId) {
        return ResponseEntity.ok(matchAvailabilityPollService.getResponses(clubId, matchId, pollId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}/players/{playerProfileId}")
    public ResponseEntity<MatchAvailabilityPollResponsesDto> setPlayerStatus(
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @PathVariable UUID pollId,
            @PathVariable UUID playerProfileId,
            @Valid @RequestBody SetPlayerAvailabilityRequest request) {
        return ResponseEntity.ok(matchAvailabilityPollService.setPlayerStatus(
                clubId, matchId, pollId, playerProfileId, request.status()));
    }
}
