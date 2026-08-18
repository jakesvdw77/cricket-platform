package com.cricketlegend.domain;

/**
 * Lifecycle of a {@link Subscription}, per docs/specs/009-subscriptions.md. No EXPIRED/PAST_DUE —
 * both transitions are admin-driven only; see the spec's Non-goals on automatic expiry.
 */
public enum SubscriptionStatus {
    ACTIVE,
    CANCELLED
}
