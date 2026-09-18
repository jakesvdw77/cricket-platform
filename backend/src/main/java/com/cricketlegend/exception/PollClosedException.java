package com.cricketlegend.exception;

/**
 * A write against a closed {@link com.cricketlegend.domain.MatchAvailabilityPoll} — thrown by the
 * public status-set endpoint when {@code MatchAvailabilityPoll.open == false}. Maps to HTTP 409
 * via its {@link ConflictException} base — see docs/standards/backend.md and
 * docs/specs/032-match-availability-polls.md.
 */
public class PollClosedException extends ConflictException {
    public PollClosedException(String message) {
        super(message);
    }
}
