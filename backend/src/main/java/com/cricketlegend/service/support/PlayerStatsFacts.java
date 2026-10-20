package com.cricketlegend.service.support;

import com.cricketlegend.domain.DismissalType;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * docs/specs/103-player-stats.md, "Shape of the read" point 4: the few per-player rows that are not additive counters
 * (recent form, innings by batting position, how the player was dismissed and which dismissals the player took as a
 * bowler). Newest first for the two form lists. Input to {@link PlayerStatsCalculator} alongside the counters.
 */
public record PlayerStatsFacts(
        List<InningsFact> recentInnings,
        List<SpellFact> recentSpells,
        List<PositionFact> positions,
        Map<DismissalType, Long> batterDismissals,
        Map<DismissalType, Long> bowlerDismissals) {

    public static final PlayerStatsFacts EMPTY =
            new PlayerStatsFacts(List.of(), List.of(), List.of(), Map.of(), Map.of());

    /** {@code runs} and {@code balls} are null when not recorded. */
    public record InningsFact(UUID matchId, Instant matchDate, Integer runs, boolean notOut, Integer balls) {
    }

    public record SpellFact(UUID matchId, Instant matchDate, long wickets, long runs, long balls, int ballsPerOver) {
    }

    public record PositionFact(int position, long innings, long runs, long dismissals) {
    }
}
