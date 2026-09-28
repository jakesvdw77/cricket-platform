package com.cricketlegend.exception;

/**
 * A public write against a closed {@code SectionAvailabilityWindow} — thrown by the public
 * status-set endpoint when {@code SectionAvailabilityWindow.open == false}. Maps to HTTP 409 via
 * its {@link ConflictException} base — see docs/specs/063-section-availability-and-flexible-squads.md.
 */
public class SectionAvailabilityWindowClosedException extends ConflictException {
    public SectionAvailabilityWindowClosedException(String message) {
        super(message);
    }
}
