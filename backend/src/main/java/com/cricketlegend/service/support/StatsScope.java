package com.cricketlegend.service.support;

import java.util.Set;
import java.util.UUID;

/**
 * docs/specs/103-player-stats.md: which published results a statistics read covers. Carries no caller or access
 * information (so a later player-facing route can reuse it): whoever builds it has already narrowed
 * {@code sectionTeamIds}, the club teams whose games count (null means no restriction). Docs/specs/145: {@code
 * playerVisibleOnly} keeps only results a manager switched on for the Player Hub (false for every manager read), and
 * {@code matchId} (nullable) narrows the read to one match.
 */
public record StatsScope(
        UUID clubId,
        UUID seasonId,
        UUID leagueId,
        UUID teamId,
        Set<UUID> sectionTeamIds,
        Competition competition,
        boolean playerVisibleOnly,
        UUID matchId) {

    /** The manager scope: every counted appearance, any match (docs/specs/145 adds the two Player Hub fields). */
    public StatsScope(
            UUID clubId, UUID seasonId, UUID leagueId, UUID teamId, Set<UUID> sectionTeamIds, Competition competition) {
        this(clubId, seasonId, leagueId, teamId, sectionTeamIds, competition, false, null);
    }

    /** League matches have a league; friendlies have none. */
    public enum Competition {
        LEAGUE,
        FRIENDLY
    }

    public boolean sectionRestricted() {
        return sectionTeamIds != null;
    }
}
