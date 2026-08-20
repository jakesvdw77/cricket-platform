package com.cricketlegend.domain;

/**
 * The fixed, flat set of role names a {@link RoleAssignment} can grant, per
 * docs/specs/015-person-status-and-role-assignment.md — no hierarchy, no per-permission
 * granularity beneath a name (015's Non-goals). Concrete roles for known, real consumers only:
 * {@code CLUB_ADMIN} is what the next (Keycloak-provisioning) spec grants to a Subscription's
 * responsible {@link Person}.
 */
public enum RoleAssignmentRole {
    CLUB_ADMIN,
    MANAGER,
    PLAYER
}
