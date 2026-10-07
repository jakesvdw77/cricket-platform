package com.cricketlegend.service.support;

import java.time.Instant;

/**
 * The earliest covered kickoff (default close time) and the reopen anchor ({@link
 * ReopenWindow#latestStart}) of a group availability round; either is {@code null} when there is
 * nothing to derive it from (docs/specs/082-poll-card-improvements.md).
 */
public record RoundSpan(Instant earliestKickoff, Instant latestStart) {

    public static final RoundSpan NONE = new RoundSpan(null, null);
}
