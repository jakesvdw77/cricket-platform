package com.cricketlegend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

/**
 * POST .../leagues/{leagueId}/duplicate payload: the new league's name, the seasons whose playing conditions to copy, and
 * the two optional copy flags (null means true). See docs/specs/096-duplicate-league.md.
 */
public record DuplicateLeagueRequest(
        @NotBlank @Size(max = 255) String name,
        List<UUID> seasonIds,
        Boolean copyPlayingConditions,
        Boolean copyContacts) {
}
