package com.cricketlegend.service;

import com.cricketlegend.dto.CreateMatchRequest;
import com.cricketlegend.dto.MatchDto;
import com.cricketlegend.dto.UpdateMatchRequest;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;

/**
 * A club's own scheduled fixture — see docs/specs/029-league-management.md.
 *
 * <p>Per docs/specs/035-section-scoped-access.md: every method now takes the caller's {@link
 * Authentication}. A match's "own section(s)" are resolved via {@link
 * com.cricketlegend.config.AccessService#resolveMatchSectionIds} against whichever of {@code
 * homeTeamId}/{@code awayTeamId} references a real {@code Team} of this club — a match resolving
 * to zero of this club's own sections is reachable only by a {@code CLUB}-scope admin.
 */
public interface MatchService {

    /**
     * Paginated, default sort {@code matchDate} descending when the caller specifies none.
     * Unrestricted callers use the plain club-wide query; a restricted caller, or anyone passing
     * an explicit {@code sectionId}, uses the section-filtered query instead — a real query-level
     * filter, not fetch-then-filter, since this list is genuinely paginated.
     *
     * <p>Per docs/specs/037-match-improvements.md: when {@code upcomingOnly} is {@code true},
     * restricts the result to matches whose {@code matchDate} falls on or after the start of
     * today ({@code ZoneId.systemDefault()} — no per-club timezone concept yet) — a match played
     * earlier today is still included, one played yesterday is not. {@code false} (the default)
     * preserves the unfiltered behaviour exactly.
     */
    Page<MatchDto> list(
            Authentication authentication, UUID clubId, UUID sectionId, boolean upcomingOnly, Pageable pageable);

    MatchDto get(Authentication authentication, UUID clubId, UUID matchId);

    /**
     * Creates a match. {@code clubId} (the acting club from the URL) is always the saved {@code
     * club_id} — never derived from {@code homeTeamId}'s own club. Validates exactly one of
     * home-team-id/name and exactly one of away-team-id/name; {@code leagueId}/{@code seasonId}
     * must belong to {@code clubId} when set ({@code seasonId} is required); {@code homeTeamId}/
     * {@code awayTeamId}, when set, must reference a real {@code Team} of ANY club. A
     * section-scoped caller may only schedule a match where at least one of their own club's team
     * references falls within their own accessible sections, resolved against the request body's
     * own team ids (the match doesn't exist yet).
     */
    MatchDto create(Authentication authentication, UUID clubId, CreateMatchRequest request);

    /** Same validation as {@link #create}. */
    MatchDto update(Authentication authentication, UUID clubId, UUID matchId, UpdateMatchRequest request);

    /** Throws {@link com.cricketlegend.exception.InvalidStatusTransitionException} if already inactive. */
    MatchDto deactivate(Authentication authentication, UUID clubId, UUID matchId);

    /** Throws {@link com.cricketlegend.exception.InvalidStatusTransitionException} if already active. */
    MatchDto reactivate(Authentication authentication, UUID clubId, UUID matchId);
}
