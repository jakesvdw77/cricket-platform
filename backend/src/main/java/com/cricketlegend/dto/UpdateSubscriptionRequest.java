package com.cricketlegend.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

/**
 * PUT /api/v1/platform/subscriptions/{id} payload. No {@code ownerId}/{@code ownerType} — the
 * owning Club can't change after creation (cancel and create a new one to reassign), per
 * docs/specs/009-subscriptions.md's UI Requirements. No {@code responsiblePerson}/person-related
 * field at all — per docs/specs/014-subscription-responsible-contact.md, who's responsible for a
 * Subscription cannot be changed through this endpoint. Reassigning who's accountable is a bigger
 * identity operation than editing a subscription's own fields, closer in kind to a
 * transfer-of-ownership action than a routine edit; folding it into this same endpoint risks it
 * happening as an unintended side effect of an admin re-saving the form for an unrelated reason.
 * If reassignment turns out to be a real, recurring operational need, it should get its own
 * explicit action/endpoint (e.g. {@code POST /subscriptions/{id}/reassign-responsible-person}) —
 * not built here, flagged for whoever needs it next.
 */
public record UpdateSubscriptionRequest(@NotNull UUID productId, LocalDate startDate, LocalDate endDate) {
}
