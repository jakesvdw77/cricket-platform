package com.cricketlegend.service;

import com.cricketlegend.dto.AddMatchSidePlayerRequest;
import com.cricketlegend.dto.CreateMatchSideRequest;
import com.cricketlegend.dto.MatchSideDto;
import com.cricketlegend.dto.ReorderMatchSidePlayersRequest;
import com.cricketlegend.dto.UpdateMatchSidePlayerRequest;
import com.cricketlegend.dto.UpdateMatchSideRequest;
import java.util.List;
import java.util.UUID;

/**
 * A {@code Match}'s playing-XI sides — see docs/specs/029-league-management.md's
 * MatchSide/MatchSidePlayer business rules.
 */
public interface MatchSideService {

    List<MatchSideDto> list(UUID clubId, UUID matchId);

    /**
     * {@code teamId} must equal one of the match's own {@code homeTeamId}/{@code awayTeamId}
     * (400 otherwise); throws {@link com.cricketlegend.exception.ConflictException} if a side for
     * that team already exists on this match.
     */
    MatchSideDto createSide(UUID clubId, UUID matchId, CreateMatchSideRequest request);

    /**
     * Sets captain/wicketkeeper/twelfth man. Captain/keeper must already be in the ordered XI;
     * twelfth man must NOT be, and is independently re-validated for squad membership and age
     * eligibility.
     */
    MatchSideDto updateSide(UUID clubId, UUID matchId, UUID sideId, UpdateMatchSideRequest request);

    /**
     * Appends a player at the end of the batting order. Validates squad membership (for the
     * match's own season), the applicable XI cap, and age eligibility, in that order; throws
     * {@link com.cricketlegend.exception.ConflictException} if already added.
     */
    MatchSideDto addPlayer(UUID clubId, UUID matchId, UUID sideId, AddMatchSidePlayerRequest request);

    /** Updates only {@code role}; batting order/eligibility are unaffected. */
    MatchSideDto updatePlayerRole(
            UUID clubId, UUID matchId, UUID sideId, UUID playerProfileId, UpdateMatchSidePlayerRequest request);

    /** Also clears {@code captainPlayerId}/{@code wicketKeeperPlayerId} if they pointed at the removed player. */
    MatchSideDto removePlayer(UUID clubId, UUID matchId, UUID sideId, UUID playerProfileId);

    /** {@code playerProfileIds} must exactly match the side's current players (400 otherwise). */
    MatchSideDto reorderPlayers(UUID clubId, UUID matchId, UUID sideId, ReorderMatchSidePlayersRequest request);
}
