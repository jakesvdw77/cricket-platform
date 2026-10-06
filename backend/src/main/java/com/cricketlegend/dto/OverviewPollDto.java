package com.cricketlegend.dto;

import com.cricketlegend.domain.AvailabilityPollType;
import java.time.Instant;
import java.util.UUID;

/**
 * One open availability poll on the manager overview. {@code kind} SQUAD is a per-match
 * {@code MatchAvailabilityPoll} ({@code id} is the poll id, {@code matchId} its match); GROUP is a
 * section-level {@code SectionAvailabilityRound} ({@code id} is the round id, {@code matchId} null).
 * {@code title} is a short human label composed server-side. {@code totalCount} is the audience
 * (squad size, or the section's active players); {@code repliedCount} those who answered (for a
 * group poll, those who answered every one of its windows). {@code scheduledCloseAt} is null when
 * the poll has no close time.
 */
public record OverviewPollDto(
        AvailabilityPollType kind,
        UUID id,
        UUID matchId,
        String title,
        long repliedCount,
        long totalCount,
        Instant scheduledCloseAt) {
}
