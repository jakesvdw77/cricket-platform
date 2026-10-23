package com.cricketlegend.service.support;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * docs/specs/088: games played for the Players list. A match counts once per player when the player is on the team
 * list of a published result for it, or was selected for a started match that has no published result. A selection
 * for a match that has a published result does not count: the result is the truth. Pure.
 */
public final class PlayerGamesCounter {

    private PlayerGamesCounter() {}

    /** One player's presence in one match. */
    public record PlayerMatch(UUID playerId, UUID matchId) {}

    public static Map<UUID, Long> count(
            Collection<PlayerMatch> resultAppearances,
            Collection<PlayerMatch> selections,
            Set<UUID> matchesWithPublishedResult) {
        Set<PlayerMatch> counted = new HashSet<>(resultAppearances);
        for (PlayerMatch selection : selections) {
            if (!matchesWithPublishedResult.contains(selection.matchId())) {
                counted.add(selection);
            }
        }
        Map<UUID, Long> games = new HashMap<>();
        counted.forEach(pm -> games.merge(pm.playerId(), 1L, Long::sum));
        return games;
    }
}
