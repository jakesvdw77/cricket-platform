package com.cricketlegend.domain;

/**
 * Lifecycle of a {@link Lead}, per docs/specs/004-landing-page.md's allowed-transition table:
 * NEW -> CONTACTED, NEW -> DISMISSED, CONTACTED -> CONVERTED, CONTACTED -> DISMISSED.
 * No transition out of CONVERTED or DISMISSED.
 */
public enum LeadStatus {
    NEW,
    CONTACTED,
    CONVERTED,
    DISMISSED
}
