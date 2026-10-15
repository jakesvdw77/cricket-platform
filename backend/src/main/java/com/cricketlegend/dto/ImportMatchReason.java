package com.cricketlegend.dto;

/** docs/specs/104-match-results-import-adaptors.md, stage 1: one piece of evidence that a match is the file's match. */
public enum ImportMatchReason {
    EXTERNAL_ID,
    GIVEN,
    DATE,
    TEAMS,
    VENUE,
    COMPETITION
}
