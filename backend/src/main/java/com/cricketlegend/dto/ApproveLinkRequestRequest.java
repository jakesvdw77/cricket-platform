package com.cricketlegend.dto;

import com.cricketlegend.domain.MainAgentMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/**
 * {@code POST .../link-requests/{id}/approve}. Exactly one of {@code playerId} and {@code newPlayer}; {@code confirm}
 * must be {@code true}, enforced by the server (docs/specs/119).
 */
public record ApproveLinkRequestRequest(
        UUID playerId, @Valid NewLinkedPlayerRequest newPlayer, @NotNull MainAgentMode mainAgentMode, @NotNull Boolean confirm) {}
