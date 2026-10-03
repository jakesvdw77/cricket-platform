package com.cricketlegend.service;

import com.cricketlegend.dto.CopyLeagueTeamsRequest;
import com.cricketlegend.dto.CopyLeagueTeamsResponse;
import com.cricketlegend.dto.CreateLeagueTeamRequest;
import com.cricketlegend.dto.LeagueTeamDto;
import com.cricketlegend.dto.RemoveLeagueTeamResponse;
import com.cricketlegend.dto.UpdateLeagueTeamRequest;
import java.util.List;
import java.util.UUID;

/**
 * Club-admin management of a league season's {@link com.cricketlegend.domain.LeagueTeam}s. Every
 * method validates that {@code leagueId}/{@code seasonId} (and a {@code leagueTeamId}, which must
 * also sit in that league and season) belong to {@code clubId} — a mismatch reads as {@link
 * com.cricketlegend.exception.NotFoundException}. See docs/specs/070-league-teams.md.
 */
public interface LeagueTeamService {

    /** The league season's league teams sorted by name; {@code activeOnly} drops inactive rows. */
    List<LeagueTeamDto> list(UUID clubId, UUID leagueId, UUID seasonId, boolean activeOnly);

    /** Creates one; 400 on a blank name, 409 on a duplicate name (case-insensitive, inactive included). */
    LeagueTeamDto create(UUID clubId, UUID leagueId, UUID seasonId, CreateLeagueTeamRequest request);

    /**
     * Updates name/abbreviation/logo; when the name or logo actually changed, rewrites the
     * denormalised name/logo on every referencing match in the same transaction.
     */
    LeagueTeamDto update(
            UUID clubId, UUID leagueId, UUID seasonId, UUID leagueTeamId, UpdateLeagueTeamRequest request);

    /** 409 ({@code InvalidStatusTransitionException}) when already inactive. Matches untouched. */
    LeagueTeamDto deactivate(UUID clubId, UUID leagueId, UUID seasonId, UUID leagueTeamId);

    /** 409 when already active. */
    LeagueTeamDto reactivate(UUID clubId, UUID leagueId, UUID seasonId, UUID leagueTeamId);

    /** Hard-deletes an unreferenced league team ({@code DELETED}); otherwise deactivates it ({@code DEACTIVATED}). */
    RemoveLeagueTeamResponse remove(UUID clubId, UUID leagueId, UUID seasonId, UUID leagueTeamId);

    /**
     * Copies the chosen rows of another league and season of the same club into this one, in one
     * transaction. 400 on empty ids or an id outside the stated source; 404 when the source league
     * or season is another club's; duplicates by lower(name) (in the target or within the batch)
     * are skipped and reported.
     */
    CopyLeagueTeamsResponse copy(UUID clubId, UUID leagueId, UUID seasonId, CopyLeagueTeamsRequest request);
}
