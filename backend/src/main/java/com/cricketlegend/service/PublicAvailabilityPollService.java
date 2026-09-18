package com.cricketlegend.service;

import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.dto.PublicAvailabilityPollDto;
import java.util.UUID;

/**
 * Public, unauthenticated surface for docs/specs/032-match-availability-polls.md, entirely under
 * {@code /api/v1/public/polls}. No {@code clubId} parameter anywhere — every method resolves the
 * {@code Match}/{@code Team}/{@code League}/{@code Season} context entirely from the poll's own
 * id, since the poll's UUID is the only thing gating access (see the spec's Non-goals/Rollout
 * Notes on this deliberate trust posture).
 */
public interface PublicAvailabilityPollService {

    PublicAvailabilityPollDto getPoll(UUID pollId);

    PublicAvailabilityPollDto setAvailability(UUID pollId, UUID playerProfileId, AvailabilityStatus status);
}
