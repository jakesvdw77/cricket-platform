package com.cricketlegend.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

/**
 * PUT /api/v1/platform/subscriptions/{id} payload. No {@code ownerId}/{@code ownerType} — the
 * owning Club can't change after creation (cancel and create a new one to reassign), per
 * docs/specs/009-subscriptions.md's UI Requirements.
 */
public record UpdateSubscriptionRequest(@NotNull UUID productId, LocalDate startDate, LocalDate endDate) {
}
