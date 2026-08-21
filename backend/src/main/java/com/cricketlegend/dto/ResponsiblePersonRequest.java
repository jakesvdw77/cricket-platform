package com.cricketlegend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Wire-shaped input for a Subscription's responsible party, per
 * docs/specs/014-subscription-responsible-contact.md — the caller submits the person's own
 * fields, never a {@code personId} it can't yet have. Resolved server-side via
 * {@code PersonService.findOrCreatePerson} before a Subscription is saved: if the email already
 * belongs to an existing {@link com.cricketlegend.domain.Person}, that Person is linked as-is
 * (its own stored {@code firstName}/{@code lastName}/{@code phone} win — "link, don't overwrite")
 * regardless of what's typed here for those fields.
 */
public record ResponsiblePersonRequest(
        @NotBlank String firstName,
        @NotBlank String lastName,
        @NotBlank @Email String email,
        String phone) {
}
