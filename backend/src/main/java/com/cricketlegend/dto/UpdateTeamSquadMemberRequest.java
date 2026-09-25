package com.cricketlegend.dto;

/**
 * PUT .../squad/{playerId} payload — a full-resource replace of this join row's two editable
 * fields, {@code jerseyNumber} and {@code isCaptain} (docs/specs/057-team-extended-profile.md
 * renamed this from {@code UpdateTeamSquadMemberJerseyNumberRequest} and added {@code isCaptain}
 * alongside the original {@code jerseyNumber}-only shape). {@code jerseyNumber} stays nullable
 * (clearing the number back out is a valid edit), unlike {@link UpdateMatchSidePlayerRequest}'s
 * required {@code role}.
 *
 * <p>This is a real, easy-to-get-wrong point, flagged explicitly by the spec: the frontend's
 * jersey-number-edit and captain-toggle actions are two separate, independently-triggered UI
 * interactions, but both now call this same full-resource PUT — each caller must send the
 * sibling field's current value along with the one actually changing, or it will silently
 * clear/reset whichever field wasn't included. See docs/specs/029-league-management.md (the
 * original endpoint) and docs/specs/031-jersey-numbers.md ({@code jerseyNumber}'s first-ever
 * mutation) for prior history.
 */
public record UpdateTeamSquadMemberRequest(Integer jerseyNumber, boolean isCaptain) {
}
