package com.cricketlegend.controller;

import com.cricketlegend.dto.PublicAvailabilityPollDto;
import com.cricketlegend.dto.SetPlayerAvailabilityRequest;
import com.cricketlegend.service.PublicAvailabilityPollService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/032-match-availability-polls.md's public, unauthenticated poll surface — the second
 * consumer of {@code /api/v1/public/**} ({@code SecurityConfig}'s existing {@code permitAll}),
 * after {@link PublicClubController}, and the first to serve real per-record tenant data and
 * accept a public write. No {@code @PreAuthorize} on either method — a poll's own unguessable
 * UUID is the entire access boundary (see the spec's Rollout Notes on this deliberate tradeoff).
 */
@RestController
public class PublicAvailabilityPollController {

    private final PublicAvailabilityPollService publicAvailabilityPollService;

    public PublicAvailabilityPollController(PublicAvailabilityPollService publicAvailabilityPollService) {
        this.publicAvailabilityPollService = publicAvailabilityPollService;
    }

    @GetMapping("/api/v1/public/polls/{pollId}")
    public ResponseEntity<PublicAvailabilityPollDto> getPoll(@PathVariable UUID pollId) {
        return ResponseEntity.ok(publicAvailabilityPollService.getPoll(pollId));
    }

    @PutMapping("/api/v1/public/polls/{pollId}/players/{playerProfileId}")
    public ResponseEntity<PublicAvailabilityPollDto> setAvailability(
            @PathVariable UUID pollId,
            @PathVariable UUID playerProfileId,
            @Valid @RequestBody SetPlayerAvailabilityRequest request) {
        return ResponseEntity.ok(
                publicAvailabilityPollService.setAvailability(pollId, playerProfileId, request.status()));
    }
}
