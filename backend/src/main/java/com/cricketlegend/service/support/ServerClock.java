package com.cricketlegend.service.support;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * Per docs/specs/037-match-improvements.md: start of the current local day uses {@code
 * ZoneId.systemDefault()}, the one existing timezone precedent in this codebase ({@code
 * EmailTestSendServiceImpl}); no per-club timezone concept yet. Extracted from {@code
 * MatchServiceImpl} so the player availability grid (docs/specs/068-player-availability-grid.md)
 * shares the rule instead of copying it.
 */
public final class ServerClock {

    private ServerClock() {}

    public static Instant startOfToday() {
        return LocalDate.now(ZoneId.systemDefault()).atStartOfDay(ZoneId.systemDefault()).toInstant();
    }
}
