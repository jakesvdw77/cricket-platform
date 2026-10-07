package com.cricketlegend.dto;

import com.cricketlegend.domain.AvailabilityStatus;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/** One answer: {@code windowId} is null for a squad poll, the window's id for a group poll. */
public record PublicAnswerDto(UUID windowId, @NotNull AvailabilityStatus status) {
}
