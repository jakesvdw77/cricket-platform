package com.cricketlegend.domain;

/**
 * How far a side's (or, aggregated, a match's) team selection has got, for the team-selection hub
 * (docs/specs/093-team-selection-hub.md): nobody picked, part picked, the full batting line-up
 * picked and ready to announce, or announced.
 */
public enum TeamSelectionStatus {
    NOT_STARTED,
    IN_PROGRESS,
    READY_TO_ANNOUNCE,
    ANNOUNCED
}
