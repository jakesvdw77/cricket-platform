package com.cricketlegend.exception;

/**
 * A {@code SectionAvailabilityWindow} already exists for the requested {@code (sectionId,
 * windowDate, dayPart)} triple. Maps to HTTP 409 via its {@link ConflictException} base — see
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public class DuplicateAvailabilityWindowException extends ConflictException {
    public DuplicateAvailabilityWindowException(String message) {
        super(message);
    }
}
