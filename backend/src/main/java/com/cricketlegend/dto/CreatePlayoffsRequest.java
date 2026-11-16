package com.cricketlegend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * POST .../leagues/{leagueId}/seasons/{seasonId}/playoffs[/preview] payload (docs/specs/155): a stage ("Playoff",
 * "Semi-final", any text) and the games of the round. {@code acknowledgedWarnings} are the scheduling warning codes the
 * manager has confirmed, as for a single match (docs/specs/132).
 */
public record CreatePlayoffsRequest(
        @NotBlank @Size(max = 60) String stage,
        @NotEmpty @Valid List<PlayoffGameRequest> games,
        List<String> acknowledgedWarnings) {
}
