package com.cricketlegend.domain;

/**
 * Where a {@link League} is administered from. {@code EXTERNAL} is a reserved placeholder for a
 * future CricClubs sync (Phase 2, not built here — see docs/specs/029-league-management.md's
 * Non-goals) — every {@link League} created by this spec's own endpoints is {@code INTERNAL}.
 */
public enum LeagueSource {
    INTERNAL,
    EXTERNAL
}
