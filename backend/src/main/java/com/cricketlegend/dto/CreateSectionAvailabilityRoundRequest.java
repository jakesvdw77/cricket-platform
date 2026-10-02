package com.cricketlegend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

/**
 * POST /api/v1/manage/clubs/{clubId}/section-availability-rounds payload — per this spec's
 * fixture-group-selection revision: no {@code roundDate}/{@code dayPart}, the admin's own selected
 * matches decide both. {@code 400} if {@code matchIds} is empty, or if any {@code matchId} isn't a
 * real match of a team in this section; {@code 404} if {@code sectionId} belongs
 * to a different club; {@code 409} ({@code MatchAlreadyPolledException}) naming the conflicting
 * match(es) if any selected {@code matchId}'s own bracket already has a window. See
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public record CreateSectionAvailabilityRoundRequest(
        @NotNull UUID sectionId,
        @NotBlank String description,
        @NotEmpty List<UUID> matchIds,
        boolean autoClose) {
}
