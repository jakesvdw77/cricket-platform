package com.cricketlegend.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * A waiting link request for the manager (docs/specs/119, Access, Player accounts). The typed fields are what the
 * requester typed; {@code suggestedPlayer} is only a suggestion from the club's own players by name and date of birth
 * (or the player the requester was shown, {@code targetPlayerId}).
 */
public record LinkRequestDto(
        UUID id,
        String requesterName,
        String requesterEmail,
        String typedFirstName,
        String typedLastName,
        LocalDate typedDateOfBirth,
        Integer typedAge,
        String message,
        String contactNumber,
        Instant createdAt,
        UUID targetPlayerId,
        SuggestedPlayerDto suggestedPlayer,
        UUID sectionId,
        String sectionName) {}
