package com.cricketlegend.dto;

import com.cricketlegend.domain.SubscriptionOwnerType;
import com.cricketlegend.domain.SubscriptionStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Full read shape of a Subscription, for the platform_admin Subscriptions screen. Embeds
 * {@code club}/{@code product} summaries so the list screen doesn't need N+1 follow-up calls per
 * row. See docs/specs/009-subscriptions.md.
 */
public record SubscriptionDto(
        UUID id,
        SubscriptionOwnerType ownerType,
        UUID ownerId,
        ClubSummaryDto club,
        ProductSummaryDto product,
        SubscriptionStatus status,
        LocalDate startDate,
        LocalDate endDate,
        ContactDto responsibleContact,
        Instant createdAt,
        Instant updatedAt,
        UUID updatedBy) {
}
