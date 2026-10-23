package com.cricketlegend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code POST .../players/{playerId}/links}: the club invites an email as main agent; {@code confirm} must be true. */
public record ManagerInviteRequest(@NotBlank @Size(max = 255) String email, Boolean confirm) {}
