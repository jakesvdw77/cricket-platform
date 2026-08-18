package com.cricketlegend.dto;

import java.util.UUID;

/**
 * Pre-auth public club shape — id/name/slug only, no branding/membership detail. Same "no
 * sensitive data before acceptance" rule as 003's public invitation endpoint. See
 * docs/specs/004-landing-page.md. {@code id} was added in docs/specs/009-subscriptions.md so the
 * Subscription form's Club picker (which reuses this DTO via the existing public search endpoint)
 * has a real database id to submit — the value is an opaque UUID, not sensitive, so this is an
 * additive, backward-compatible change to an already-shipped public endpoint.
 */
public record ClubSummaryDto(UUID id, String name, String slug) {
}
