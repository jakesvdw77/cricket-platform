package com.cricketlegend.dto;

import com.cricketlegend.domain.AgentInviteMode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** {@code POST /api/v1/me/players/{playerKey}/agents} (docs/specs/119): the main agent invites an email. */
public record InviteAgentRequest(@NotBlank @Size(max = 255) String email, @NotNull AgentInviteMode mode) {}
