package com.cricketlegend.exception;

/**
 * At least one {@code matchId} requested for a new {@code SectionAvailabilityRound} resolves to a
 * bracket that already has a {@code SectionAvailabilityWindow} (from any round, open or closed) —
 * a defensive re-check against a possibly-stale fixture-group list, the service-layer counterpart
 * to {@code section_availability_window}'s own {@code (section_id, window_date, day_part)} unique
 * constraint. Maps to HTTP 409 via its {@link ConflictException} base. See
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public class MatchAlreadyPolledException extends ConflictException {
    public MatchAlreadyPolledException(String message) {
        super(message);
    }
}
