package com.cricketlegend.dto;

import java.util.UUID;

/** docs/specs/145: the Season, Team and League filters a Player Hub results read was computed for (null is no filter). */
public record MyResultScopeDto(UUID seasonId, UUID teamId, UUID leagueId) {}
