package com.cricketlegend.service.support;

import java.util.Set;
import java.util.UUID;

/**
 * docs/specs/103-player-stats.md: which published results a statistics read covers. Carries no caller or access
 * information (so a later player-facing route can reuse it): whoever builds it has already narrowed
 * {@code sectionTeamIds}, the club teams whose games count (null means no restriction).
 */
public record StatsScope(
        UUID clubId,
        UUID seasonId,
        UUID leagueId,
        UUID teamId,
        Set<UUID> sectionTeamIds,
        Competition competition) {

    /** League matches have a league; friendlies have none. */
    public enum Competition {
        LEAGUE,
        FRIENDLY
    }

    public boolean sectionRestricted() {
        return sectionTeamIds != null;
    }
}
