package com.cricketlegend.service.support;

import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * docs/specs/147, "Reach (default, Open question 1)": the leagues whose players a held player may see ranked, as
 * (season, league) pairs: every league one of the player's teams played in during that season (a flagged counted result
 * of the player, or an affiliation of one of the player's teams; the caller collects the pairs). A friendly has no league, so it is outside the reach.
 * Pure: it holds ids only and carries no access information.
 */
public record HubLeaderboardReach(Set<SeasonLeague> pairs) {

    /** One league in one season. */
    public record SeasonLeague(UUID seasonId, UUID leagueId) {
    }

    /** The reach of the given pairs; a pair without a season or a league (a friendly) is left out. */
    public static HubLeaderboardReach of(Collection<SeasonLeague> pairs) {
        Set<SeasonLeague> kept = new HashSet<>();
        for (SeasonLeague pair : pairs) {
            if (pair.seasonId() != null && pair.leagueId() != null) {
                kept.add(pair);
            }
        }
        return new HubLeaderboardReach(Set.copyOf(kept));
    }

    /** The leagues reached in a season; a null season is every season. */
    public Set<UUID> leagueIds(UUID seasonId) {
        Set<UUID> leagues = new HashSet<>();
        for (SeasonLeague pair : pairs) {
            if (seasonId == null || seasonId.equals(pair.seasonId())) {
                leagues.add(pair.leagueId());
            }
        }
        return Set.copyOf(leagues);
    }

    public boolean contains(UUID seasonId, UUID leagueId) {
        return pairs.contains(new SeasonLeague(seasonId, leagueId));
    }
}
