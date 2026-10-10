package com.cricketlegend.service;

import com.cricketlegend.domain.AvailabilityPollTypeFilter;
import com.cricketlegend.domain.AvailabilitySummaryPlayerKind;
import com.cricketlegend.dto.AvailabilitySummaryDto;
import com.cricketlegend.dto.AvailabilitySummaryPlayerDto;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;

/** The availability counters of docs/specs/081-plain-page-header-and-counters.md, scoped to the caller's sections. */
public interface AvailabilitySummaryService {

    /**
     * Counters over the polls of {@code clubId} the caller can see that match the optional filters
     * (docs/specs/083): {@code seasonId} (null = all seasons) narrows with the poll lists' own season rule (squad poll by its match's season, group poll when any active match in its windows is in the season); open polls only unless {@code includeClosed}; {@code type} null means ALL.
     * Never includes another club's data; 404 for another club's league or team, 403 for a section
     * (or team section) the caller cannot administer.
     */
    AvailabilitySummaryDto summary(
            Authentication authentication,
            UUID clubId,
            UUID leagueId,
            UUID sectionId,
            UUID teamId,
            UUID seasonId,
            AvailabilityPollTypeFilter type,
            boolean includeClosed);

    /**
     * The players behind the {@code playersResponded} / {@code playersStillToAnswer} counters
     * (docs/specs/084), each once with the polls that put them in the list, for the same filters as
     * {@link #summary}; {@code totalElements} equals the matching counter when {@code closingSoon} is
     * false and {@code search} is empty. {@code closingSoon} keeps only open polls closing within 48
     * hours; {@code search} is a case-insensitive contains on the display name. Sorted by number of
     * polls descending, then name; the requested sort is ignored and the page size is capped at 100.
     *
     * <p><b>In-memory paging is a deliberate, documented exception</b> to the backend pagination rule
     * (docs/plans/084-clickable-counters.md, decision 3), valid only for this derived list: players
     * exist only as the union of several poll audiences, so there is no SQL to {@code LIMIT}. The
     * real bound: open polls are not capped per club, closed polls are capped at {@code
     * AvailabilityPollFilter.CLOSED_POLLS_LIMIT} (50) per kind, and the work is a single pass over the
     * sets {@code OverviewPolls} has already loaded in a fixed number of queries (the same
     * aggregation the counters read), followed by two batched name lookups and a slice. Do not copy
     * this pattern for a genuinely unbounded list. Same errors as {@link #summary}; a null {@code
     * kind} is a 400.
     */
    Page<AvailabilitySummaryPlayerDto> players(
            Authentication authentication,
            UUID clubId,
            AvailabilitySummaryPlayerKind kind,
            UUID leagueId,
            UUID sectionId,
            UUID teamId,
            UUID seasonId,
            AvailabilityPollTypeFilter type,
            boolean includeClosed,
            boolean closingSoon,
            String search,
            Pageable pageable);
}
