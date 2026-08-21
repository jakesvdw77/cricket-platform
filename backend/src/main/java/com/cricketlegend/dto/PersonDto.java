package com.cricketlegend.dto;

import java.util.UUID;

/**
 * Full read shape of a Person — the {@code responsiblePerson} embedded in {@link SubscriptionDto}
 * and the shape returned by {@code GET /api/v1/platform/persons}. See
 * docs/specs/014-subscription-responsible-contact.md.
 */
public record PersonDto(UUID id, String firstName, String lastName, String email, String phone) {
}
