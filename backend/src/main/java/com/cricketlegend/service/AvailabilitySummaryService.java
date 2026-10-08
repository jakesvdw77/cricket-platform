package com.cricketlegend.service;

import com.cricketlegend.domain.AvailabilityPollTypeFilter;
import com.cricketlegend.dto.AvailabilitySummaryDto;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/** The availability counters of docs/specs/081-plain-page-header-and-counters.md, scoped to the caller's sections. */
public interface AvailabilitySummaryService {

    /**
     * Counters over the polls of {@code clubId} the caller can see that match the optional filters
     * (docs/specs/083): open polls only unless {@code includeClosed}; {@code type} null means ALL.
     * Never includes another club's data; 404 for another club's league or team, 403 for a section
     * (or team section) the caller cannot administer.
     */
    AvailabilitySummaryDto summary(
            Authentication authentication,
            UUID clubId,
            UUID leagueId,
            UUID sectionId,
            UUID teamId,
            AvailabilityPollTypeFilter type,
            boolean includeClosed);
}
