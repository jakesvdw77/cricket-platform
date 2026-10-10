package com.cricketlegend.dto;

import java.util.UUID;

/** Result of a league duplication: the new league and what was copied. See docs/specs/096-duplicate-league.md. */
public record DuplicateLeagueResponse(
        UUID leagueId, String name, int seasonsCopied, int playingConditionsCopied, int contactsCopied) {
}
