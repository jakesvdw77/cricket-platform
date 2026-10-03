package com.cricketlegend.dto;

import com.cricketlegend.domain.AvailabilityPollType;
import java.util.UUID;

/**
 * One availability poll covering a match, as shown on the Matches list card
 * (docs/specs/069-match-card-redesign.md). A {@code GROUP} entry covers the match once: {@code
 * teamId} is {@code null}, {@code pollId} equals {@code roundId} and {@code open} is the window's.
 * A {@code SQUAD} entry is one per club-team side: {@code roundId} is {@code null}, {@code pollId}
 * is the {@code MatchAvailabilityPoll} id.
 */
public record MatchPollDto(
        AvailabilityPollType type, UUID teamId, UUID pollId, UUID roundId, boolean open) {
}
