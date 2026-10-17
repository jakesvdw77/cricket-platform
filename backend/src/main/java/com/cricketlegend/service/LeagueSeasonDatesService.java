package com.cricketlegend.service;

import com.cricketlegend.dto.LeagueSeasonDatesDto;
import com.cricketlegend.dto.UpdateLeagueSeasonDatesRequest;
import java.util.UUID;

/** The start and end date of a league in a season (docs/specs/111-league-season-dates.md). */
public interface LeagueSeasonDatesService {

    /** The dates; {@code leagueId} and {@code seasonId} must belong to {@code clubId} (404), and 404 when none are set. */
    LeagueSeasonDatesDto get(UUID clubId, UUID leagueId, UUID seasonId);

    /**
     * Creates or replaces the dates. 404 for another club's league or season; {@link
     * com.cricketlegend.exception.ValidationException} when a date is missing or the start is after the end; {@link
     * com.cricketlegend.exception.LeagueDatesExcludeMatchesException} when an active match of the league in the season
     * would fall outside them.
     */
    LeagueSeasonDatesDto update(
            UUID clubId, UUID leagueId, UUID seasonId, UpdateLeagueSeasonDatesRequest request, UUID updatedBy);
}
