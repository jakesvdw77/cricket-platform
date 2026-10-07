package com.cricketlegend.service;

import com.cricketlegend.dto.PublicAnswersDto;
import com.cricketlegend.dto.PublicAnswersRequest;
import com.cricketlegend.dto.PublicRoundHeaderDto;
import com.cricketlegend.dto.PublicVerifyRequest;
import com.cricketlegend.dto.PublicVerifyResponseDto;
import java.util.UUID;

/**
 * Public, unauthenticated surface of a group poll ({@code SectionAvailabilityRound}), the same shape
 * as {@link PublicAvailabilityPollService} with one answer per window. See
 * docs/specs/077-public-availability-form-verification.md.
 */
public interface PublicSectionAvailabilityRoundService {

    PublicRoundHeaderDto getHeader(UUID roundId);

    PublicVerifyResponseDto verify(UUID roundId, PublicVerifyRequest request, String clientAddress);

    PublicAnswersDto getAnswers(UUID roundId, UUID playerId, String token);

    PublicAnswersDto saveAnswers(UUID roundId, UUID playerId, String token, PublicAnswersRequest request);
}
