package com.cricketlegend.domain;

/**
 * docs/specs/088-players-polls-alignment.md: whether a manager has accepted a player's profile. Manager-created players
 * are {@code VERIFIED}; a profile created later by a parent or player through self-registration starts {@code
 * UNVERIFIED}. {@code REJECTED} players are hidden from the default list but kept. A suspended player is not a status
 * here: it is {@code PlayerProfile.active = false}.
 */
public enum PlayerVerificationStatus {
    VERIFIED,
    UNVERIFIED,
    REJECTED
}
