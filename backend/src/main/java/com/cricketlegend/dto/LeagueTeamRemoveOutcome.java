package com.cricketlegend.dto;

/** What {@code remove} actually did to a league team: hard-deleted it, or deactivated it because matches use it. */
public enum LeagueTeamRemoveOutcome {
    DELETED,
    DEACTIVATED
}
