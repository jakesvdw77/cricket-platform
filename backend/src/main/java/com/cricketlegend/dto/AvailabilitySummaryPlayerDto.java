package com.cricketlegend.dto;

import com.cricketlegend.domain.AvailabilityPollType;
import java.util.List;
import java.util.UUID;

/**
 * One player in the availability players list (docs/specs/084): who they are and the polls (of
 * those shown by the counters' filters) that put them in the list. {@code PollRef.matchId} is null
 * for a group poll.
 */
public record AvailabilitySummaryPlayerDto(UUID playerProfileId, String displayName, List<PollRef> polls) {

    /** A poll reference built from the overview poll fields. */
    public record PollRef(AvailabilityPollType kind, UUID id, UUID matchId, String title) {
    }
}
