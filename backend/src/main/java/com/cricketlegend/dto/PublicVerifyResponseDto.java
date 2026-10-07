package com.cricketlegend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Verify result: VERIFIED carries playerId/firstName/lastName/token/expiresAt, PICK carries only
 * {@code candidates}, NO_DATE_OF_BIRTH carries only {@code status}. Unused fields are omitted.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PublicVerifyResponseDto(
        PublicVerifyStatus status,
        UUID playerId,
        String firstName,
        String lastName,
        String token,
        Instant expiresAt,
        List<PublicPickCandidateDto> candidates) {

    public static PublicVerifyResponseDto verified(
            UUID playerId, String firstName, String lastName, String token, Instant expiresAt) {
        return new PublicVerifyResponseDto(
                PublicVerifyStatus.VERIFIED, playerId, firstName, lastName, token, expiresAt, null);
    }

    public static PublicVerifyResponseDto pick(List<PublicPickCandidateDto> candidates) {
        return new PublicVerifyResponseDto(PublicVerifyStatus.PICK, null, null, null, null, null, candidates);
    }

    public static PublicVerifyResponseDto noDateOfBirth() {
        return new PublicVerifyResponseDto(PublicVerifyStatus.NO_DATE_OF_BIRTH, null, null, null, null, null, null);
    }
}
