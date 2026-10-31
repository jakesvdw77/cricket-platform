package com.cricketlegend.service.support.schedule;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

/**
 * The facts of an existing match the schedule rules need (docs/specs/098-league-schedule-import.md). The caller maps
 * entities onto it. {@code dependants} are the reason codes of things attached to the match (POLL, GROUP_POLL,
 * SQUAD_POOL, SELECTION, ANNOUNCED_TEAM, RESULT); an update that moves the time is blocked when any exists. A side
 * with neither id is free text (a manual match typed by hand).
 */
public record ExistingMatch(
        UUID id,
        UUID leagueId,
        UUID seasonId,
        Instant start,
        String venue,
        Side home,
        Side away,
        boolean active,
        Set<String> dependants) {

    /** {@code teamId} is one of the club's own teams; {@code name} is the displayed or typed name. */
    public record Side(UUID teamId, UUID leagueTeamId, String name) {

        public boolean freeText() {
            return teamId == null && leagueTeamId == null;
        }
    }

    public ExistingMatch {
        dependants = dependants == null ? Set.of() : dependants;
    }
}
