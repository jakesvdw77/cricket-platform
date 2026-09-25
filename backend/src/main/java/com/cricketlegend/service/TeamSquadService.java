package com.cricketlegend.service;

import com.cricketlegend.dto.TeamSquadMemberDto;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/**
 * A {@code Team}'s squad for a given {@code Season} — season-scoped, not standing, per this
 * spec's own pre-build amendment. Returns {@link TeamSquadMemberDto}, per
 * docs/specs/031-jersey-numbers.md — {@code TeamSquadMember} gained its own mutable {@code
 * jerseyNumber} attribute, so a bare {@code PlayerDto} no longer fully describes a squad row. See
 * docs/specs/029-league-management.md.
 *
 * <p>Per docs/specs/035-section-scoped-access.md: every method now takes the caller's {@link
 * Authentication} — a section-scoped caller manages only their own team's squad, checked against
 * the already-loaded {@code Team.sectionId}.
 */
public interface TeamSquadService {

    /** The team's squad for that season. 404s if {@code teamId}/{@code seasonId} doesn't belong to {@code clubId}. */
    List<TeamSquadMemberDto> list(Authentication authentication, UUID clubId, UUID teamId, UUID seasonId);

    /**
     * Adds {@code playerId} to {@code teamId}'s squad for {@code seasonId}. 404s if the player
     * isn't a real player of this club, or {@code teamId}/{@code seasonId} doesn't belong to
     * {@code clubId}; throws {@link com.cricketlegend.exception.PlayerNotActiveClubMemberException}
     * if the player exists but is currently inactive; throws {@link
     * com.cricketlegend.exception.ConflictException} if already in that season's squad. The new
     * row's {@code jerseyNumber} is pre-populated from the player's current {@code
     * PlayerProfile.jerseyNumber} (a plain value copy, not a live reference) — this method never
     * checks jersey-number uniqueness itself, even if the copied value collides with another
     * squad member's number; that's corrected later via {@link #update}, not rejected here.
     */
    TeamSquadMemberDto add(Authentication authentication, UUID clubId, UUID teamId, UUID seasonId, UUID playerId);

    /**
     * Updates {@code playerId}'s squad membership {@code jerseyNumber}/{@code isCaptain} for
     * {@code teamId}/{@code seasonId} — the only two mutable attributes on this row, per
     * docs/specs/057-team-extended-profile.md's rename of the request DTO to {@code
     * UpdateTeamSquadMemberRequest} (a full-resource replace of both fields together). 404s if
     * {@code teamId}/{@code seasonId} doesn't belong to {@code clubId}, or if the player isn't
     * currently in that season's squad. Throws {@link
     * com.cricketlegend.exception.ValidationException} if {@code jerseyNumber} is negative, and
     * {@link com.cricketlegend.exception.DuplicateSquadJerseyNumberException} if another squad
     * member already holds that number for this team's squad this season. When {@code isCaptain}
     * is {@code true}, silently un-marks whoever else currently holds the captaincy for {@code
     * teamId}/{@code seasonId} — never a {@link com.cricketlegend.exception.ConflictException}.
     */
    TeamSquadMemberDto update(
            Authentication authentication,
            UUID clubId,
            UUID teamId,
            UUID seasonId,
            UUID playerId,
            Integer jerseyNumber,
            boolean isCaptain);

    /**
     * Removes {@code playerId} from {@code teamId}'s squad for {@code seasonId} (hard delete of
     * the join row) — has no effect on any other season's row for the same player/team. Throws
     * {@link com.cricketlegend.exception.NotFoundException} if not currently in that season's
     * squad. Does not retroactively remove the player from any {@code MatchSide} they're already
     * selected on.
     */
    void remove(Authentication authentication, UUID clubId, UUID teamId, UUID seasonId, UUID playerId);
}
