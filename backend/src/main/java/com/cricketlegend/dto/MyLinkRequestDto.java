package com.cricketlegend.dto;

import com.cricketlegend.domain.LinkRequestStatus;
import java.time.Instant;
import java.util.UUID;

/** One of the caller's own link requests, as My players shows it (docs/specs/119). */
public record MyLinkRequestDto(
        UUID id,
        String clubName,
        String playerName,
        LinkRequestStatus status,
        String decisionNote,
        Instant createdAt,
        Instant decidedAt,
        String sectionName) {}
