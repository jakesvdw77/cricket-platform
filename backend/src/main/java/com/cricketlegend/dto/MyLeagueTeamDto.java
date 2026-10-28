package com.cricketlegend.dto;

import java.util.UUID;

/** docs/specs/123: one active team of a league season; {@code mine} marks the held player's own teams. */
public record MyLeagueTeamDto(UUID id, String name, String abbreviation, String logoUrl, boolean mine) {
}
