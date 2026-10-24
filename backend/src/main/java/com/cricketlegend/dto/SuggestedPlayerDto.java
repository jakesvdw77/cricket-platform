package com.cricketlegend.dto;

import java.util.UUID;

/** The club's own player a link request probably refers to (docs/specs/119). The stored date of birth is shown to the club's own managers only (owner approved: it powers the date-of-birth warning). */
public record SuggestedPlayerDto(
        UUID playerId,
        String firstName,
        String lastName,
        java.time.LocalDate dateOfBirth,
        boolean exactMatch,
        String sectionName,
        boolean hasMainAgent,
        String mainAgentName) {}
