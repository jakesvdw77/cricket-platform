package com.cricketlegend.domain;

/**
 * The four scope levels a {@link RoleAssignment} can bind to, per
 * docs/specs/001-tenancy-identity-model.md's original scope hierarchy. Matches
 * {@link SubscriptionOwnerType}'s "recognized value, not yet buildable" precedent
 * (docs/specs/009-subscriptions.md): only {@code CLUB} is actually created, validated, or resolved
 * by anything built as of docs/specs/015-person-status-and-role-assignment.md. {@code SECTION}/
 * {@code TEAM} are reserved for once those entities exist in code — see 015's Non-goals.
 * {@code PLATFORM} is reserved too, but deliberately unused: the vendor-level equivalent stays the
 * flat {@code platform_admin} Keycloak realm role (docs/specs/002-realm-subdomain-auth.md), not a
 * RoleAssignment row — see 015's Non-goals for why the two are never conflated.
 */
public enum ScopeType {
    PLATFORM,
    CLUB,
    SECTION,
    TEAM
}
