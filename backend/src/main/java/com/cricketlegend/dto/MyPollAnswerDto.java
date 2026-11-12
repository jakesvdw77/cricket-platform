package com.cricketlegend.dto;

import com.cricketlegend.domain.AvailabilityStatus;
import java.util.UUID;

/** One answer of the held player on a history row: {@code windowId} and {@code label} (for example "Sat morning") are null for a squad poll. */
public record MyPollAnswerDto(UUID windowId, String label, AvailabilityStatus status) {
}
