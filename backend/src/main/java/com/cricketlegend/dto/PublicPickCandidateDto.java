package com.cricketlegend.dto;

import java.util.UUID;

/** One of several same-name, same-date players offered for the client to choose from. */
public record PublicPickCandidateDto(UUID playerId, Integer shirtNumber, String teamLabel) {
}
