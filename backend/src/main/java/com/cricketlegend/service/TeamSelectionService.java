package com.cricketlegend.service;

import com.cricketlegend.dto.TeamSelectionOverviewDto;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/** Read-only team-selection overview per docs/specs/093-team-selection-hub.md. */
public interface TeamSelectionService {

    /**
     * Matches with their picks and players with their pick state per match, in a fixed number of
     * queries. Section scope as {@code PlayerAvailabilityService.getGrid}: an out-of-scope {@code
     * sectionId} or {@code teamId} is a 403, another club's is a 404. All filters optional; {@code
     * includePast} false keeps matches from the start of today onwards. Only active matches.
     */
    TeamSelectionOverviewDto overview(
            Authentication authentication,
            UUID clubId,
            UUID seasonId,
            UUID leagueId,
            UUID sectionId,
            UUID teamId,
            boolean includePast);
}
