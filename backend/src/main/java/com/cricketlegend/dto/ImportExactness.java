package com.cricketlegend.dto;

/**
 * docs/specs/104-match-results-import-adaptors.md: how exactly a section of an import was taken or matched. Output-only:
 * filled by the processor, never trusted from input. {@code AI_SUGGESTED} is reserved for a later AI tier and nothing
 * in this revision produces it.
 */
public enum ImportExactness {
    EXACT,
    NORMALISED,
    AI_SUGGESTED,
    UNRESOLVED
}
