package com.cricketlegend.dto;

import com.cricketlegend.domain.DayPart;
import java.time.LocalDate;
import java.util.UUID;

/**
 * One bracket row within a {@code SectionAvailabilityRound} — a round now owns however many of
 * these its own selected matches actually resolve to (one per distinct {@code (section, date,
 * day-part)} combination, no longer always exactly two, see Data Model Changes), used both in the
 * admin list row ({@link SectionAvailabilityRoundDto#brackets()}) and the admin responses view
 * ({@link SectionAvailabilityRoundResponsesDto#brackets()}). {@link #windowDate} — added by the
 * fixture-group-selection revision — is this specific bracket's own date, since a round spanning
 * several days now owns several windows, each with its own date. See
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public record SectionAvailabilityRoundBracketDto(
        DayPart dayPart,
        LocalDate windowDate,
        UUID windowId,
        long availableCount,
        long unavailableCount,
        long unsureCount,
        long noResponseCount,
        long coveredMatchCount) {
}
