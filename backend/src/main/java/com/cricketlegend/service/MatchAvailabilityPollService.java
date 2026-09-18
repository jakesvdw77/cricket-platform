package com.cricketlegend.service;

import com.cricketlegend.domain.AvailabilityStatus;
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

    // Admin override — set a squad member's status directly from the Availability tab, added after
    // a live review found no way for the admin to record a response relayed outside the poll link
    // (e.g. a phone call). Same not-in-squad 404 / closed-poll 409 rules as the public write path,
    // reusing the identical PollClosedException — an admin override still respects a closed poll,
    // matching this feature's own "closing a poll locks it, full stop, admin included" decision.
    MatchAvailabilityPollResponsesDto setPlayerStatus(
            UUID clubId, UUID matchId, UUID pollId, UUID playerProfileId, AvailabilityStatus status);
}
