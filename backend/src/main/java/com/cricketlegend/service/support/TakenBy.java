package com.cricketlegend.service.support;

import java.time.Instant;
import java.util.UUID;

/**
 * Where a player already is for a colliding slot (docs/specs/076-team-selection.md section 5): the
 * team (with its club and section, for the release check), the match, its kickoff and human slot
 * text ("Sat 3 Oct (morning)"), the side, whether that side is announced, and whether the match is
 * the one being selected for (the other side of a derby).
 */
public record TakenBy(
        UUID teamId,
        String teamName,
        UUID teamClubId,
        UUID teamSectionId,
        UUID matchId,
        Instant matchDate,
        String slotText,
        UUID sideId,
        boolean sameMatch,
        boolean announced) {
}
