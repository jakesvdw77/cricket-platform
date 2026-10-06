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

    /**
     * Start of the local day {@code daysFromToday} calendar days after today (0 is today's start).
     * Calendar arithmetic, so a daylight-saving change never shifts the boundary off midnight.
     */
    public static Instant startOfDayFromToday(int daysFromToday) {
        return LocalDate.now(ZoneId.systemDefault())
                .plusDays(daysFromToday)
                .atStartOfDay(ZoneId.systemDefault())
                .toInstant();
    }

    /**
     * The current instant on the server clock. Read once per request that needs several aggregates
     * to agree on "now" (docs/specs/071-league-card-redesign.md's {@code LeagueServiceImpl.list}).
     */
    public static Instant now() {
        return Instant.now();
    }
}
