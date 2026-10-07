package com.cricketlegend.controller;

import com.cricketlegend.dto.PublicAnswersDto;
import com.cricketlegend.dto.PublicAnswersRequest;
import com.cricketlegend.dto.PublicRoundHeaderDto;
import com.cricketlegend.dto.PublicVerifyRequest;
import com.cricketlegend.dto.PublicVerifyResponseDto;
import com.cricketlegend.service.PublicSectionAvailabilityRoundService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/**
 * The public, unauthenticated group poll surface ({@code /api/v1/public/**} is {@code permitAll}).
 * Since docs/specs/077-public-availability-form-verification.md the poll's UUID only opens the
 * header; any player data needs a successful {@code verify} and its {@code X-Public-Token}.
 */
@RestController
public class PublicSectionAvailabilityRoundController {

    static final String TOKEN_HEADER = "X-Public-Token";

    private final PublicSectionAvailabilityRoundService roundService;

    public PublicSectionAvailabilityRoundController(PublicSectionAvailabilityRoundService roundService) {
        this.roundService = roundService;
    }

    @GetMapping("/api/v1/public/section-availability-rounds/{roundId}")
    public ResponseEntity<PublicRoundHeaderDto> getRound(@PathVariable UUID roundId) {
        return ResponseEntity.ok(roundService.getHeader(roundId));
    }

    @PostMapping("/api/v1/public/section-availability-rounds/{roundId}/verify")
    public ResponseEntity<PublicVerifyResponseDto> verify(
            @PathVariable UUID roundId, @Valid @RequestBody PublicVerifyRequest request, HttpServletRequest http) {
        return ResponseEntity.ok(roundService.verify(roundId, request, http.getRemoteAddr()));
    }

    @GetMapping("/api/v1/public/section-availability-rounds/{roundId}/players/{playerId}/answers")
    public ResponseEntity<PublicAnswersDto> getAnswers(
            @PathVariable UUID roundId,
            @PathVariable UUID playerId,
            @RequestHeader(value = TOKEN_HEADER, required = false) String token) {
        return ResponseEntity.ok(roundService.getAnswers(roundId, playerId, token));
    }

    @PutMapping("/api/v1/public/section-availability-rounds/{roundId}/players/{playerId}/answers")
    public ResponseEntity<PublicAnswersDto> putAnswers(
            @PathVariable UUID roundId,
            @PathVariable UUID playerId,
            @RequestHeader(value = TOKEN_HEADER, required = false) String token,
            @Valid @RequestBody PublicAnswersRequest request) {
        return ResponseEntity.ok(roundService.saveAnswers(roundId, playerId, token, request));
    }
}
