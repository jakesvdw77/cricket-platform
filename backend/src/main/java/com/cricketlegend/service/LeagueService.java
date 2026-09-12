package com.cricketlegend.service;

import com.cricketlegend.dto.CreateLeagueRequest;
import com.cricketlegend.dto.LeagueDto;
import com.cricketlegend.dto.UpdateLeagueRequest;
import java.util.List;
import java.util.UUID;

/**
 * A club's own internal league — see docs/specs/029-league-management.md.
 */
public interface LeagueService {

    /** Every league for {@code clubId} (active and inactive). */
    List<LeagueDto> list(UUID clubId);

    /** Creates a league for {@code clubId}. Validates {@code minAge <= maxAge} when both are set. */
    LeagueDto create(UUID clubId, CreateLeagueRequest request);

    /** Full-resource update. Same {@code minAge <= maxAge} validation as {@link #create}. */
    LeagueDto update(UUID clubId, UUID leagueId, UpdateLeagueRequest request);

    /** Throws {@link com.cricketlegend.exception.InvalidStatusTransitionException} if already inactive. */
    LeagueDto deactivate(UUID clubId, UUID leagueId);

    /** Throws {@link com.cricketlegend.exception.InvalidStatusTransitionException} if already active. */
    LeagueDto reactivate(UUID clubId, UUID leagueId);
}
