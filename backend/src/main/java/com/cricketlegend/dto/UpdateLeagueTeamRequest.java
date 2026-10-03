package com.cricketlegend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * PUT .../league-teams/{leagueTeamId} payload — same shape and validation as {@link
 * CreateLeagueTeamRequest}. A name or logo change propagates to every referencing match. See
 * docs/specs/070-league-teams.md.
 */
public record UpdateLeagueTeamRequest(
        @NotBlank @Size(max = 255) String name,
        @Size(max = 16) String abbreviation,
        @Size(max = 1024) String logoUrl) {
}
