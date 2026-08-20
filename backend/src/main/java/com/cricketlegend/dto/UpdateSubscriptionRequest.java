package com.cricketlegend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

/**
 * PUT /api/v1/platform/subscriptions/{id} payload. No {@code ownerId}/{@code ownerType} — the
 * owning Club can't change after creation (cancel and create a new one to reassign), per
 * docs/specs/009-subscriptions.md's UI Requirements. {@code responsibleContact} is optional —
 * no {@code @NotNull} — but {@code @Valid} still cascades if present, so a provided-but-incomplete
 * contact is rejected the same way it would be on create. Per
 * docs/specs/014-subscription-responsible-contact.md's full-replace-when-provided posture, the
 * service applies this field unconditionally: a {@code null} in the request clears any
 * previously-set contact.
 */
public record UpdateSubscriptionRequest(
        @NotNull UUID productId, LocalDate startDate, LocalDate endDate, @Valid ContactDto responsibleContact) {
}
