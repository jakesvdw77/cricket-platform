package com.cricketlegend.service;

import com.cricketlegend.dto.PublicAnswersDto;
import com.cricketlegend.dto.PublicAnswersRequest;
import com.cricketlegend.dto.PublicPollHeaderDto;
import com.cricketlegend.dto.PublicVerifyRequest;
import com.cricketlegend.dto.PublicVerifyResponseDto;
import java.util.UUID;

/**
 * Public, unauthenticated surface of a squad poll (docs/specs/032, reshaped by
 * docs/specs/077-public-availability-form-verification.md): a header, a verify step, and answers
 * that need the token verify issued. Nothing about any player is returned before a successful verify.
 */
public interface PublicAvailabilityPollService {

    PublicPollHeaderDto getHeader(UUID pollId);

    PublicVerifyResponseDto verify(UUID pollId, PublicVerifyRequest request, String clientAddress);

    PublicAnswersDto getAnswers(UUID pollId, UUID playerId, String token);

    PublicAnswersDto saveAnswers(UUID pollId, UUID playerId, String token, PublicAnswersRequest request);
}
