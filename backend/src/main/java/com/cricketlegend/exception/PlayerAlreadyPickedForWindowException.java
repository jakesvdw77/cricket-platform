package com.cricketlegend.exception;

/**
 * A player already holds a {@code MatchSquadMember} row for the same resolved {@code
 * SectionAvailabilityWindow}, via a different match/team — the Part C hard block's service-layer,
 * clean-error-message counterpart to the DB-level {@code (section_availability_window_id,
 * player_profile_id)} unique constraint. The message names which {@code matchId}/{@code teamId}/
 * team name they're already picked for. Maps to HTTP 409 via its {@link ConflictException} base —
 * see docs/specs/063-section-availability-and-flexible-squads.md.
 */
public class PlayerAlreadyPickedForWindowException extends ConflictException {
    public PlayerAlreadyPickedForWindowException(String message) {
        super(message);
    }
}
