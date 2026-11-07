package com.cricketlegend.service.support;

import java.util.Set;
import java.util.UUID;

/**
 * docs/specs/103-player-stats.md: which published results a statistics read covers. Carries no caller or access
 * information (so a later player-facing route can reuse it): whoever builds it has already narrowed
 * {@code sectionTeamIds}, the club teams whose games count (null means no restriction). Docs/specs/145: {@code
 * playerVisibleOnly} keeps only results a manager switched on for the Player Hub (false for every manager read), and
 * {@code matchId} (nullable) narrows the read to one match. Docs/specs/147: {@code leagueReachIds} (nullable; null is no
 * restriction and what every manager read carries) keeps only matches of those leagues, so a Player Hub leaderboard counts
 * the players of the competitions the viewer's teams play in (a friendly has no league, so it is outside the reach); an
 * empty set matches nothing.
 */
public record StatsScope(
        UUID clubId,
        UUID seasonId,
        UUID leagueId,
        UUID teamId,
        Set<UUID> sectionTeamIds,
        Competition competition,
        boolean playerVisibleOnly,
        UUID matchId,
        Set<UUID> leagueReachIds) {

    /** The manager scope: every counted appearance, any match (docs/specs/145 adds the two Player Hub fields). */
    public StatsScope(
            UUID clubId, UUID seasonId, UUID leagueId, UUID teamId, Set<UUID> sectionTeamIds, Competition competition) {
        this(clubId, seasonId, leagueId, teamId, sectionTeamIds, competition, false, null, null);
    }

    /** The Player Hub scope of docs/specs/145: no league reach. */
    public StatsScope(
            UUID clubId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            Set<UUID> sectionTeamIds,
            Competition competition,
            boolean playerVisibleOnly,
            UUID matchId) {
        this(clubId, seasonId, leagueId, teamId, sectionTeamIds, competition, playerVisibleOnly, matchId, null);
    }

    /** League matches have a league; friendlies have none. */
    public enum Competition {
        LEAGUE,
        FRIENDLY
    }

    public boolean sectionRestricted() {
        return sectionTeamIds != null;
    }

    /** Whether only matches of {@link #leagueReachIds} count (Player Hub leaderboards). */
    public boolean leagueReachRestricted() {
        return leagueReachIds != null;
    }

    /** This scope restricted to matches of the given leagues (an empty set matches nothing). */
    public StatsScope withLeagueReach(Set<UUID> leagues) {
        return new StatsScope(
                clubId, seasonId, leagueId, teamId, sectionTeamIds, competition, playerVisibleOnly, matchId, Set.copyOf(leagues));
    }

    /** This scope restricted to the games of the given club teams (the team-wide figures of a Player Hub read). */
    public StatsScope withTeams(Set<UUID> teams) {
        return new StatsScope(
                clubId, seasonId, leagueId, teamId, Set.copyOf(teams), competition, playerVisibleOnly, matchId, leagueReachIds);
    }
}
