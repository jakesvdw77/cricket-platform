package com.cricketlegend.service;

import com.cricketlegend.dto.CreateMatchAvailabilityPollRequest;
import com.cricketlegend.dto.MatchAvailabilityPollDto;
import com.cricketlegend.dto.MatchAvailabilityPollResponsesDto;
import java.util.List;
import java.util.UUID;

/**
 * Admin surface for docs/specs/032-match-availability-polls.md, entirely under {@code
 * /api/v1/manage/clubs/{clubId}/matches/{matchId}/polls} — every method scoped to {@code clubId}
 * first, matching {@code MatchSideService}'s exact isolation posture.
 */
public interface MatchAvailabilityPollService {

    List<MatchAvailabilityPollDto> list(UUID clubId, UUID matchId);

    MatchAvailabilityPollDto create(UUID clubId, UUID matchId, CreateMatchAvailabilityPollRequest request);

    MatchAvailabilityPollDto open(UUID clubId, UUID matchId, UUID pollId);

    MatchAvailabilityPollDto close(UUID clubId, UUID matchId, UUID pollId);

    MatchAvailabilityPollResponsesDto getResponses(UUID clubId, UUID matchId, UUID pollId);
}
