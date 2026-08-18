package com.cricketlegend.dto;

import com.cricketlegend.domain.SubscriptionOwnerType;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

/**
 * POST /api/v1/platform/subscriptions payload. {@code startDate} is left un-annotated for
 * null-ness — {@code null} means "use today", applied by {@code Subscription}'s
 * {@code @PrePersist} hook. {@code endDate} is optional; {@code null} means ongoing. See
 * docs/specs/009-subscriptions.md.
 */
public record CreateSubscriptionRequest(
        @NotNull SubscriptionOwnerType ownerType,
        @NotNull UUID ownerId,
        @NotNull UUID productId,
        LocalDate startDate,
        LocalDate endDate) {
}
