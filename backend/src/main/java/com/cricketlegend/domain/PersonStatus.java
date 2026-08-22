package com.cricketlegend.domain;

/**
 * Lifecycle of a {@link Person}, per docs/specs/015-person-status-and-role-assignment.md — mirrors
 * {@link SubscriptionStatus}'s bare-enum shape (docs/specs/009-subscriptions.md).
 *
 * <p>{@code PENDING} is set on every newly-created {@link Person} by
 * {@code PersonServiceImpl.findOrCreatePerson} as of
 * docs/specs/016-keycloak-account-provisioning.md (amending 015's original default of
 * {@code ACTIVE} — see that spec's judgment call #4) and flipped to {@code ACTIVE} on first
 * successful Keycloak login by {@code MeServiceImpl.bridgeByEmail}.
 */
public enum PersonStatus {
    PENDING,
    ACTIVE,
    SUSPENDED
}
