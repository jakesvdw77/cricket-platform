package com.cricketlegend.dto;

import java.util.UUID;

/** docs/specs/123: one of the held player's teams in a league (id and name only). */
public record MyTeamRefDto(UUID id, String name) {
}
