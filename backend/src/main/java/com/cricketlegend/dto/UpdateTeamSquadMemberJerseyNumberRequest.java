package com.cricketlegend.dto;

/**
 * PUT .../squad/{playerId} payload — updates that squad member's {@code jerseyNumber} only,
 * nothing else about the row is editable. Nullable (clearing the number back out is a valid
 * edit), unlike {@link UpdateMatchSidePlayerRequest}'s required {@code role}. See
 * docs/specs/031-jersey-numbers.md.
 */
public record UpdateTeamSquadMemberJerseyNumberRequest(Integer jerseyNumber) {
}
