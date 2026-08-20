package com.cricketlegend.domain;

/**
 * Lifecycle of a {@link Person}, per docs/specs/015-person-status-and-role-assignment.md — mirrors
 * {@link SubscriptionStatus}'s bare-enum shape (docs/specs/009-subscriptions.md).
 *
 * <p>{@code PENDING} is a reserved value only — nothing in this codebase sets this status yet.
 * It's reserved for the future self-serve signup flow (docs/roadmap.md), where a Person is created
 * ahead of any admin approving them. That flow, and the Keycloak account provisioning it needs, is
 * a deliberately separate, not-yet-built spec — see 015's own Non-goals. Don't build a code path
 * that sets this value without re-reading that spec's reasoning first.
 */
public enum PersonStatus {
    PENDING,
    ACTIVE,
    SUSPENDED
}
