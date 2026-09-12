package com.cricketlegend.service;

import com.cricketlegend.dto.PlayerDto;
import java.util.List;
import java.util.UUID;

/**
 * A {@code Team}'s squad for a given {@code Season} — season-scoped, not standing, per this
 * spec's own pre-build amendment. Reuses {@code 028}'s existing {@link PlayerDto}, no new DTO.
 * See docs/specs/029-league-management.md.
 */
public interface TeamSquadService {

    /** The team's squad for that season. 404s if {@code teamId}/{@code seasonId} doesn't belong to {@code clubId}. */
    List<PlayerDto> list(UUID clubId, UUID teamId, UUID seasonId);

    /**
     * Adds {@code playerId} to {@code teamId}'s squad for {@code seasonId}. 404s if the player
     * isn't a real player of this club, or {@code teamId}/{@code seasonId} doesn't belong to
     * {@code clubId}; throws {@link com.cricketlegend.exception.PlayerNotActiveClubMemberException}
     * if the player exists but is currently inactive; throws {@link
     * com.cricketlegend.exception.ConflictException} if already in that season's squad.
     */
    PlayerDto add(UUID clubId, UUID teamId, UUID seasonId, UUID playerId);

    /**
     * Removes {@code playerId} from {@code teamId}'s squad for {@code seasonId} (hard delete of
     * the join row) — has no effect on any other season's row for the same player/team. Throws
     * {@link com.cricketlegend.exception.NotFoundException} if not currently in that season's
     * squad. Does not retroactively remove the player from any {@code MatchSide} they're already
     * selected on.
     */
    void remove(UUID clubId, UUID teamId, UUID seasonId, UUID playerId);
}
