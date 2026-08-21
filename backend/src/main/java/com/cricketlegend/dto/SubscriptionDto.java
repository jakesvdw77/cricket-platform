package com.cricketlegend.dto;

import com.cricketlegend.domain.SubscriptionOwnerType;
import com.cricketlegend.domain.SubscriptionStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Full read shape of a Subscription, for the platform_admin Subscriptions screen. Embeds
 * {@code club}/{@code product}/{@code responsiblePerson} summaries so the list screen doesn't
 * need N+1 follow-up calls per row. See docs/specs/009-subscriptions.md.
 * {@code responsiblePerson} — see docs/specs/014-subscription-responsible-contact.md — is never
 * null post-migration.
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
        PersonDto responsiblePerson,
        Instant createdAt,
        Instant updatedAt,
        UUID updatedBy) {
}
