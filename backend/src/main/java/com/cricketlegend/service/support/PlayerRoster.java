package com.cricketlegend.service.support;

import com.cricketlegend.domain.PlayerProfile;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The club's players a caller can see (docs/specs/088-players-polls-alignment.md), after the section scope and the list
 * filters but before any quick filter, with each player's section links. Shared by the players list and its summary
 * counters so the two cannot disagree. Lives here, not as a nested type of the service, because {@code service.impl}
 * holds only {@code @Service} classes.
 */
public record PlayerRoster(List<PlayerProfile> profiles, Map<UUID, List<UUID>> sectionsByProfile) {

    public static PlayerRoster empty() {
        return new PlayerRoster(List.of(), Map.of());
    }
}
