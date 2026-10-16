package com.cricketlegend.domain;

/**
 * docs/specs/104-match-results-import-adaptors.md: why an imported player link is still a guess to confirm
 * ({@code result_player.import_match}). {@code NORMALISED} is a rule-based link; {@code AI_SUGGESTED} is reserved for a
 * later tier and never produced in this revision.
 */
public enum ImportMatchLevel {
    NORMALISED,
    AI_SUGGESTED
}
