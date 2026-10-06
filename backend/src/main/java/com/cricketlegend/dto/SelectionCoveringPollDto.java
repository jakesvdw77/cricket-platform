package com.cricketlegend.dto;

import com.cricketlegend.domain.PollCoverageKind;
import java.util.UUID;

/**
 * The poll covering a match, for the UI's inline "Set answer" menu (docs/specs/076-team-selection.md).
 * SQUAD: {@code pollId} is the squad poll, {@code roundId} null. GROUP: {@code pollId} equals
 * {@code roundId}. {@code matchId} is always the match.
 */
public record SelectionCoveringPollDto(PollCoverageKind kind, UUID pollId, UUID roundId, UUID matchId) {
}
