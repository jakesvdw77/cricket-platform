package com.cricketlegend.controller;

import com.cricketlegend.dto.CreateMatchAvailabilityPollRequest;
import com.cricketlegend.dto.MatchAvailabilityPollDto;
import com.cricketlegend.dto.MatchAvailabilityPollResponsesDto;
import com.cricketlegend.dto.OpenAvailabilityPollDto;
import com.cricketlegend.dto.SetPlayerAvailabilityRequest;
import com.cricketlegend.service.MatchAvailabilityPollService;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/032-match-availability-polls.md: a {@code Match}'s availability polls, on {@code
 * /api/v1/manage/clubs/{clubId}/matches/{matchId}/polls}. docs/specs/034-availability-polls-dashboard.md
 * adds the club-wide {@link #listOpen} endpoint; docs/specs/035-section-scoped-access.md widens
 * every {@code @PreAuthorize} here from {@code canAdministerClub} to {@code canAccessClub} (a
 * section-scoped caller's own reach is enforced inside the service layer, resolved per-match) and
 * threads {@link Authentication} through to the service.
 */
@RestController
public class MatchAvailabilityPollController {

    private final MatchAvailabilityPollService matchAvailabilityPollService;

    public MatchAvailabilityPollController(MatchAvailabilityPollService matchAvailabilityPollService) {
        this.matchAvailabilityPollService = matchAvailabilityPollService;
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls")
    public ResponseEntity<List<MatchAvailabilityPollDto>> list(
            Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID matchId) {
        return ResponseEntity.ok(matchAvailabilityPollService.list(authentication, clubId, matchId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls")
    @ApiResponse(responseCode = "201", description = "Availability poll created")
    public ResponseEntity<MatchAvailabilityPollDto> create(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @Valid @RequestBody CreateMatchAvailabilityPollRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(matchAvailabilityPollService.create(authentication, clubId, matchId, request));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}/open")
    public ResponseEntity<MatchAvailabilityPollDto> open(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @PathVariable UUID pollId) {
        return ResponseEntity.ok(matchAvailabilityPollService.open(authentication, clubId, matchId, pollId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}/close")
    public ResponseEntity<MatchAvailabilityPollDto> close(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @PathVariable UUID pollId) {
        return ResponseEntity.ok(matchAvailabilityPollService.close(authentication, clubId, matchId, pollId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}/responses")
    public ResponseEntity<MatchAvailabilityPollResponsesDto> getResponses(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @PathVariable UUID pollId) {
        return ResponseEntity.ok(matchAvailabilityPollService.getResponses(authentication, clubId, matchId, pollId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}/players/{playerProfileId}")
    public ResponseEntity<MatchAvailabilityPollResponsesDto> setPlayerStatus(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @PathVariable UUID pollId,
            @PathVariable UUID playerProfileId,
            @Valid @RequestBody SetPlayerAvailabilityRequest request) {
        return ResponseEntity.ok(matchAvailabilityPollService.setPlayerStatus(
                authentication, clubId, matchId, pollId, playerProfileId, request.status()));
    }

    /** docs/specs/034-availability-polls-dashboard.md, section-aware per docs/specs/035. */
    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/availability-polls/open")
    public ResponseEntity<List<OpenAvailabilityPollDto>> listOpen(
            Authentication authentication,
            @PathVariable UUID clubId,
            @RequestParam(required = false) UUID sectionId) {
        return ResponseEntity.ok(matchAvailabilityPollService.listOpenForClub(authentication, clubId, sectionId));
    }
}
