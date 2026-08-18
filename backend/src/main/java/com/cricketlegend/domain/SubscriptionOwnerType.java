package com.cricketlegend.domain;

/**
 * Who a {@link Subscription} belongs to. Only {@code CLUB} is validated as usable by
 * SubscriptionServiceImpl today — {@code SECTION} exists here for forward-compatibility only,
 * since a real {@code Section} entity doesn't exist in code yet. See
 * docs/specs/009-subscriptions.md's Non-goals.
 */
public enum SubscriptionOwnerType {
    CLUB,
    SECTION
}
