package com.cricketlegend.dto;

import java.util.UUID;

/** The club's own player a link request probably refers to (docs/specs/119). Never a full date of birth. */
public record SuggestedPlayerDto(
        UUID playerId,
        String firstName,
        String lastName,
        java.time.LocalDate dateOfBirth,
        boolean exactMatch,
        String sectionName,
        boolean hasMainAgent,
        String mainAgentName) {}
