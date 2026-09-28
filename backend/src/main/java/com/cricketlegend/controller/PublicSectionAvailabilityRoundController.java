package com.cricketlegend.controller;

import com.cricketlegend.dto.PublicSectionAvailabilityRoundDto;
import com.cricketlegend.dto.SetSectionAvailabilityRoundPlayerRequest;
import com.cricketlegend.service.PublicSectionAvailabilityRoundService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/063-section-availability-and-flexible-squads.md's public, unauthenticated round
 * surface — the round-model revision's own "one shared link per section per day," replacing the
 * prior pass's bare-window equivalent. Mirrors {@link PublicAvailabilityPollController}'s bare-
 * {@code @RestController} precedent exactly. No {@code @PreAuthorize} on either method — a
 * round's own unguessable UUID is the entire access boundary, the same deliberate tradeoff
 * docs/specs/032's own Rollout Notes already made.
 */
@RestController
public class PublicSectionAvailabilityRoundController {

    private final PublicSectionAvailabilityRoundService publicSectionAvailabilityRoundService;

    public PublicSectionAvailabilityRoundController(
            PublicSectionAvailabilityRoundService publicSectionAvailabilityRoundService) {
        this.publicSectionAvailabilityRoundService = publicSectionAvailabilityRoundService;
    }

    @GetMapping("/api/v1/public/section-availability-rounds/{roundId}")
    public ResponseEntity<PublicSectionAvailabilityRoundDto> getRound(@PathVariable UUID roundId) {
        return ResponseEntity.ok(publicSectionAvailabilityRoundService.getRound(roundId));
    }

    @PutMapping("/api/v1/public/section-availability-rounds/{roundId}/players/{playerProfileId}")
    public ResponseEntity<PublicSectionAvailabilityRoundDto> setAvailability(
            @PathVariable UUID roundId,
            @PathVariable UUID playerProfileId,
            @Valid @RequestBody SetSectionAvailabilityRoundPlayerRequest request) {
        return ResponseEntity.ok(publicSectionAvailabilityRoundService.setAvailability(
                roundId, playerProfileId, request.windowId(), request.status()));
    }
}
