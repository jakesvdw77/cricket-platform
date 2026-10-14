package com.cricketlegend.service.support;

import com.cricketlegend.domain.ResultSide;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * docs/specs/101: what the scorecard rules need that is not in the draft, loaded by the service: the league's maximum
 * balls per bowler, each side's squad for the match's season (a side absent from {@code squadBySide} is not checked),
 * the club's registered players by normalised name (for {@code GUEST_NAME_MATCHES_PLAYER}) and display names of the
 * linked players (for messages).
 */
public record ScorecardContext(
        Integer maxBallsPerBowler,
        Map<ResultSide, Set<UUID>> squadBySide,
        Map<String, UUID> registeredPlayersByName,
        Map<UUID, String> playerNames) {

    /** No extra context: the rules that need none still run. */
    public static ScorecardContext none() {
        return new ScorecardContext(null, Map.of(), Map.of(), Map.of());
    }

    /** The lower-cased, trimmed, whitespace-collapsed form names are compared in. */
    public static String normalise(String name) {
        return name == null ? "" : name.trim().replaceAll("\\s+", " ").toLowerCase(java.util.Locale.ROOT);
    }
}
