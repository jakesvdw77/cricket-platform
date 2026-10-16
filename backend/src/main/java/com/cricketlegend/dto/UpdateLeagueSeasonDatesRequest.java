package com.cricketlegend.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

/**
 * PUT .../leagues/{leagueId}/seasons/{seasonId}/dates payload (docs/specs/111-league-season-dates.md): both dates are
 * required and the start may not be after the end.
 */
public record UpdateLeagueSeasonDatesRequest(
        @NotNull(message = "startDate is required") LocalDate startDate,
        @NotNull(message = "endDate is required") LocalDate endDate) {

    @AssertTrue(message = "startDate must not be after endDate")
    boolean isStartNotAfterEnd() {
        return startDate == null || endDate == null || !startDate.isAfter(endDate);
    }
}
