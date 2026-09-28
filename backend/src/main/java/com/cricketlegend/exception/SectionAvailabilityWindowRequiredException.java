package com.cricketlegend.exception;

/**
 * A {@code MatchSquadMember} add was attempted before any {@code SectionAvailabilityWindow} exists
 * yet for the resolved {@code (team.sectionId, match.matchDate's date, match.matchDate's
 * day-part)} bracket. The message embeds that unresolved triple so the UI can offer a pre-filled
 * "create this window" shortcut. Maps to HTTP 400 via its {@link ValidationException} base — see
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public class SectionAvailabilityWindowRequiredException extends ValidationException {
    public SectionAvailabilityWindowRequiredException(String message) {
        super(message);
    }
}
