package com.cricketlegend.dto;

/**
 * Platform admin identity read straight off the verified JWT — subject, {@code
 * preferred_username}, {@code email}. No {@code Person} lookup; see docs/specs/005-admin-login.md's
 * explicit non-goal against provisioning a {@code Person} row for the admin.
 */
public record AdminIdentityDto(String keycloakUserId, String username, String email) {
}
