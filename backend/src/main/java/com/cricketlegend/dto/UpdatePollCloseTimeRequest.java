package com.cricketlegend.dto;

import java.time.Instant;

/**
 * PUT .../close-time payload for both poll kinds (docs/specs/066-poll-close-time-and-unified-cards.md).
 * {@code autoClose=false} stores no close time (any {@code scheduledCloseAt} is ignored);
 * {@code autoClose=true} requires one, in the future and no later than the earliest kickoff (400).
 */
public record UpdatePollCloseTimeRequest(boolean autoClose, Instant scheduledCloseAt) {
}
