package com.cricketlegend.service;

import com.cricketlegend.dto.PlayerAvailabilityDto;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/** Read-only season availability grid per docs/specs/068-player-availability-grid.md. */
public interface PlayerAvailabilityService {

    /**
     * Section scope as {@code MatchAvailabilityPollService.listOpenForClub}: an out-of-scope
     * {@code sectionId} or {@code teamId} is a 403, another club's is a 404. All filters optional;
     * {@code includePast} false keeps games from the start of today onwards.
     */
    PlayerAvailabilityDto getGrid(
            Authentication authentication,
            UUID clubId,
            UUID seasonId,
            UUID leagueId,
            UUID sectionId,
            UUID teamId,
            boolean includePast);
}
