package com.cricketlegend.service;

import com.cricketlegend.dto.CreateLeagueAffiliationRequest;
import com.cricketlegend.dto.LeagueAffiliationDto;
import java.util.List;
import java.util.UUID;

/**
 * A club's own {@code Team} entered into its own {@code League} for a {@code Season} — see
 * docs/specs/029-league-management.md.
 */
public interface LeagueAffiliationService {

    /** Every affiliation for {@code leagueId} (across all seasons). 404s if {@code leagueId} doesn't belong to {@code clubId}. */
    List<LeagueAffiliationDto> list(UUID clubId, UUID leagueId);

    /**
     * Affiliates {@code request.teamId()} into {@code leagueId} for {@code request.seasonId()}.
     * {@code teamId}/{@code seasonId} must each belong to {@code clubId} (404 otherwise); throws
     * {@link com.cricketlegend.exception.ConflictException} if the exact {@code (league, team,
     * season)} triple already exists.
     */
    LeagueAffiliationDto create(UUID clubId, UUID leagueId, CreateLeagueAffiliationRequest request);

    /** Hard-deletes the join row. Throws {@link com.cricketlegend.exception.NotFoundException} if no such affiliation. */
    void unaffiliate(UUID clubId, UUID leagueId, UUID affiliationId);
}
