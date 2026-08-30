package com.cricketlegend.domain;

/**
 * An optional, unenforced gender hint on a {@link Section} node — deliberately just these two
 * values, per docs/specs/025-club-structure.md's Non-goals ("no broader taxonomy"). Unset means
 * no restriction; never validated against a real person. See
 * docs/specs/025-club-structure.md.
 */
public enum Gender {
    MALE,
    FEMALE
}
