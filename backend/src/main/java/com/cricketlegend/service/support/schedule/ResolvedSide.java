package com.cricketlegend.service.support.schedule;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

/**
 * What a sheet team name is resolved to, for the schedule rules (docs/specs/098-league-schedule-import.md, "Match
 * identity"). Side identity is by resolved record, never by text: an own team is its team id, a league team its league
 * team id; a league team still to be created or copied has no id yet and is identified by its (normalised) name.
 * {@code knownNames} are other names the side is known by (remembered aliases), used to compare free-text sides of
 * existing manual matches. {@code collision} is set by the caller when a team to be created or copied clashes
 * (case-insensitively) with an existing league team of this league and season.
 */
public record ResolvedSide(
        Kind kind,
        UUID id,
        String name,
        boolean active,
        boolean affiliated,
        Collision collision,
        Set<String> knownNames) {

    public enum Kind {
        OWN_TEAM, LEAGUE_TEAM, NEW_LEAGUE_TEAM, COPIED_LEAGUE_TEAM
    }

    public record Collision(String existingName, boolean existingInactive) {}

    public ResolvedSide {
        knownNames = knownNames == null ? Set.of() : knownNames;
    }

    public static ResolvedSide ownTeam(UUID teamId, String name, boolean affiliated, Set<String> knownNames) {
        return new ResolvedSide(Kind.OWN_TEAM, teamId, name, true, affiliated, null, knownNames);
    }

    public static ResolvedSide leagueTeam(UUID leagueTeamId, String name, boolean active, Set<String> knownNames) {
        return new ResolvedSide(Kind.LEAGUE_TEAM, leagueTeamId, name, active, true, null, knownNames);
    }

    public static ResolvedSide toCreate(String name, Collision collision) {
        return new ResolvedSide(Kind.NEW_LEAGUE_TEAM, null, name, true, true, collision, Set.of());
    }

    public static ResolvedSide toCopy(UUID sourceLeagueTeamId, String name, Collision collision) {
        return new ResolvedSide(Kind.COPIED_LEAGUE_TEAM, sourceLeagueTeamId, name, true, true, collision, Set.of());
    }

    public boolean ours() {
        return kind == Kind.OWN_TEAM;
    }

    /** Stable identity string: equal sides (after resolution) have equal identities. */
    public String identity() {
        return switch (kind) {
            case OWN_TEAM -> "T:" + id;
            case LEAGUE_TEAM -> "L:" + id;
            case NEW_LEAGUE_TEAM, COPIED_LEAGUE_TEAM -> "N:" + TeamNameMatcher.normalise(name);
        };
    }

    /** Normalised name and every known name, for comparing against a free-text side. */
    public Set<String> nameKeys() {
        Set<String> keys = new LinkedHashSet<>();
        keys.add(TeamNameMatcher.normalise(name));
        knownNames.forEach(n -> keys.add(TeamNameMatcher.normalise(n)));
        keys.remove("");
        return keys;
    }
}
