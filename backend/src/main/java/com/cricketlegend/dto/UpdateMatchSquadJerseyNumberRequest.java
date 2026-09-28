package com.cricketlegend.dto;

/**
 * PUT .../matches/{matchId}/teams/{teamId}/squad/{playerId} payload — updates {@code
 * jerseyNumber} only, mirroring {@code UpdateTeamSquadMemberRequest}'s own precedent for {@code
 * MatchSquadMember} instead of {@code TeamSquadMember}. {@code jerseyNumber} stays nullable —
 * clearing the number back out is a valid edit. See
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public record UpdateMatchSquadJerseyNumberRequest(Integer jerseyNumber) {
}
