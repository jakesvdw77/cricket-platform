package com.cricketlegend.dto;

import java.util.UUID;

/** One row of "Players and their main agent" (docs/specs/119). The agent's email is masked only. */
public record PlayerAccountDto(
        UUID playerId,
        String firstName,
        String lastName,
        String sectionName,
        String mainAgentName,
        String mainAgentMaskedEmail,
        int otherAgentCount) {}
