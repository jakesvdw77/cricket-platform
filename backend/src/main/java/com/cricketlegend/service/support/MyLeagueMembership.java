package com.cricketlegend.service.support;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Team;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * docs/specs/123: a held player's league membership: season, then league, then the player's own teams in it (active
 * teams of the club only), with the leagues and teams involved.
 */
public record MyLeagueMembership(
        Map<UUID, Map<UUID, Set<UUID>>> teamIdsBySeasonLeague, Map<UUID, League> leagues, Map<UUID, Team> teams) {

    public Map<UUID, Set<UUID>> forSeason(UUID seasonId) {
        return seasonId == null ? Map.of() : teamIdsBySeasonLeague.getOrDefault(seasonId, Map.of());
    }
}
