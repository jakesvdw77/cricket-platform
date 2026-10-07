package com.cricketlegend.controller;

import com.cricketlegend.dto.PublicAnswersDto;
import com.cricketlegend.dto.PublicAnswersRequest;
import com.cricketlegend.dto.PublicPollHeaderDto;
import com.cricketlegend.dto.PublicVerifyRequest;
import com.cricketlegend.dto.PublicVerifyResponseDto;
import com.cricketlegend.service.PublicAvailabilityPollService;
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
 * The public, unauthenticated squad poll surface ({@code /api/v1/public/**} is {@code permitAll}).
 * Since docs/specs/077-public-availability-form-verification.md the poll's UUID only opens the
 * header; any player data needs a successful {@code verify} and its {@code X-Public-Token}.
 */
@RestController
public class PublicAvailabilityPollController {

    static final String TOKEN_HEADER = "X-Public-Token";

    private final PublicAvailabilityPollService publicAvailabilityPollService;

    public PublicAvailabilityPollController(PublicAvailabilityPollService publicAvailabilityPollService) {
        this.publicAvailabilityPollService = publicAvailabilityPollService;
    }

    @GetMapping("/api/v1/public/polls/{pollId}")
    public ResponseEntity<PublicPollHeaderDto> getPoll(@PathVariable UUID pollId) {
        return ResponseEntity.ok(publicAvailabilityPollService.getHeader(pollId));
    }

    @PostMapping("/api/v1/public/polls/{pollId}/verify")
    public ResponseEntity<PublicVerifyResponseDto> verify(
            @PathVariable UUID pollId, @Valid @RequestBody PublicVerifyRequest request, HttpServletRequest http) {
        return ResponseEntity.ok(publicAvailabilityPollService.verify(pollId, request, http.getRemoteAddr()));
    }

    @GetMapping("/api/v1/public/polls/{pollId}/players/{playerId}/answers")
    public ResponseEntity<PublicAnswersDto> getAnswers(
            @PathVariable UUID pollId,
            @PathVariable UUID playerId,
            @RequestHeader(value = TOKEN_HEADER, required = false) String token) {
        return ResponseEntity.ok(publicAvailabilityPollService.getAnswers(pollId, playerId, token));
    }

    @PutMapping("/api/v1/public/polls/{pollId}/players/{playerId}/answers")
    public ResponseEntity<PublicAnswersDto> putAnswers(
            @PathVariable UUID pollId,
            @PathVariable UUID playerId,
            @RequestHeader(value = TOKEN_HEADER, required = false) String token,
            @Valid @RequestBody PublicAnswersRequest request) {
        return ResponseEntity.ok(publicAvailabilityPollService.saveAnswers(pollId, playerId, token, request));
    }
}
