package com.cricketlegend.dto;

import java.time.Instant;
import java.util.UUID;

/** A waiting invitation for the caller's verified email (docs/specs/119). */
public record InvitationDto(
        UUID linkId, String playerName, String clubName, String invitedByName, boolean makeMain, Instant expiresAt) {}
