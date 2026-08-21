package com.cricketlegend.dto;

import com.cricketlegend.domain.SubscriptionOwnerType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

/**
 * POST /api/v1/platform/subscriptions payload. {@code startDate} is left un-annotated for
 * null-ness — {@code null} means "use today", applied by {@code Subscription}'s
 * {@code @PrePersist} hook. {@code endDate} is optional; {@code null} means ongoing.
 * {@code responsiblePerson} is required — per docs/specs/014-subscription-responsible-contact.md,
 * every new Subscription must record who's accountable for it, resolved via
 * {@code PersonService.findOrCreatePerson} before the Subscription is saved; {@code @Valid}
 * cascades into {@link ResponsiblePersonRequest}'s own {@code @NotBlank}/{@code @Email} checks.
 * See docs/specs/009-subscriptions.md.
 */
public record CreateSubscriptionRequest(
        @NotNull SubscriptionOwnerType ownerType,
        @NotNull UUID ownerId,
        @NotNull UUID productId,
        LocalDate startDate,
        LocalDate endDate,
        @NotNull @Valid ResponsiblePersonRequest responsiblePerson) {
}
