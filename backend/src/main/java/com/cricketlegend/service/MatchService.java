package com.cricketlegend.service;

import com.cricketlegend.dto.CreateMatchRequest;
import com.cricketlegend.dto.MatchDto;
import com.cricketlegend.dto.UpdateMatchRequest;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/** A club's own scheduled fixture — see docs/specs/029-league-management.md. */
public interface MatchService {

    /** Paginated, default sort {@code matchDate} descending when the caller specifies none. */
    Page<MatchDto> list(UUID clubId, Pageable pageable);

    MatchDto get(UUID clubId, UUID matchId);

    /**
     * Creates a match. {@code clubId} (the acting club from the URL) is always the saved {@code
     * club_id} — never derived from {@code homeTeamId}'s own club. Validates exactly one of
     * home-team-id/name and exactly one of away-team-id/name; {@code leagueId}/{@code seasonId}
     * must belong to {@code clubId} when set ({@code seasonId} is required); {@code homeTeamId}/
     * {@code awayTeamId}, when set, must reference a real {@code Team} of ANY club.
     */
    MatchDto create(UUID clubId, CreateMatchRequest request);

    /** Same validation as {@link #create}. */
    MatchDto update(UUID clubId, UUID matchId, UpdateMatchRequest request);

    /** Throws {@link com.cricketlegend.exception.InvalidStatusTransitionException} if already inactive. */
    MatchDto deactivate(UUID clubId, UUID matchId);

    /** Throws {@link com.cricketlegend.exception.InvalidStatusTransitionException} if already active. */
    MatchDto reactivate(UUID clubId, UUID matchId);
}
