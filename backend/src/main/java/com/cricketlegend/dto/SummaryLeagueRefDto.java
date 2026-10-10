package com.cricketlegend.dto;

import java.util.UUID;

/** A league's id and name in a section's {@code leagues} list (docs/specs/094-club-structure-and-seasons.md). */
public record SummaryLeagueRefDto(UUID id, String name) {
}
