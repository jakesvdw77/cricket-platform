package com.cricketlegend.dto;

import java.util.UUID;

/**
 * Part C's "already picked for {Team, Match}" indicator — present on a {@link
 * MatchSquadCandidateDto} when that candidate already holds a {@code MatchSquadMember} row for
 * this window elsewhere. See docs/specs/063-section-availability-and-flexible-squads.md.
 */
public record MatchSquadPickedElsewhereDto(UUID matchId, UUID teamId, String teamName) {
}
