package com.cricketlegend.service;

import com.cricketlegend.dto.CreatePlayoffsRequest;
import com.cricketlegend.dto.MatchDto;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/** docs/specs/155-playoff-and-knockout-fixtures.md: create a round of playoff or knockout games for a league and season. */
public interface PlayoffService {

    /**
     * Validates the whole round exactly as it would be created (sides, dates, scheduling rules, access) and returns the games
     * that would be made, writing nothing.
     */
    List<MatchDto> preview(Authentication authentication, UUID clubId, UUID leagueId, UUID seasonId, CreatePlayoffsRequest request);

    /** Creates every game of the round in one transaction (all or none) and returns them. */
    List<MatchDto> create(Authentication authentication, UUID clubId, UUID leagueId, UUID seasonId, CreatePlayoffsRequest request);
}
