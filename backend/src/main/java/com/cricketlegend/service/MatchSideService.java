package com.cricketlegend.service;

import com.cricketlegend.dto.AddMatchSidePlayerRequest;
import com.cricketlegend.dto.CreateMatchSideRequest;
import com.cricketlegend.dto.MatchSideDto;
import com.cricketlegend.dto.ReorderMatchSidePlayersRequest;
import com.cricketlegend.dto.UpdateMatchSidePlayerRequest;
import com.cricketlegend.dto.UpdateMatchSideRequest;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/**
 * A {@code Match}'s sides and their selections — see docs/specs/029-league-management.md's
 * MatchSide/MatchSidePlayer business rules.
 *
 * <p>Per docs/specs/035-section-scoped-access.md: every method now takes the caller's {@link
 * Authentication} — a section-scoped caller builds only their own section's side of a match, via
 * the same {@code resolveMatchSectionIds}/{@code assertCanAdministerAnySection} resolution
 * {@code MatchServiceImpl} uses.
 */
public interface MatchSideService {

    List<MatchSideDto> list(Authentication authentication, UUID clubId, UUID matchId);

    /**
     * {@code teamId} must equal one of the match's own {@code homeTeamId}/{@code awayTeamId}
     * (400 otherwise); throws {@link com.cricketlegend.exception.ConflictException} if a side for
     * that team already exists on this match.
     */
    MatchSideDto createSide(Authentication authentication, UUID clubId, UUID matchId, CreateMatchSideRequest request);

    /**
     * Sets captain/wicketkeeper/twelfth man (a full replace of the three). Captain and keeper must
     * be selected and not the twelfth man (400); a twelfth man must be allowed by the match's
     * limits (400) and, if not yet selected, is added through the same checks as {@link #addPlayer};
     * designating him removes his batting position. See docs/specs/076-team-selection.md.
     */
    MatchSideDto updateSide(
            Authentication authentication, UUID clubId, UUID matchId, UUID sideId, UpdateMatchSideRequest request);

    /**
     * Adds one player to the selection: the pool rule, no duplicate (409), the total cap (400), age
     * (400), then the slot (409) and said-unavailable (409) blocks. Takes the next batting position
     * while fewer than the match's batting places are used, otherwise none.
     */
    MatchSideDto addPlayer(
            Authentication authentication, UUID clubId, UUID matchId, UUID sideId, AddMatchSidePlayerRequest request);

    /** Updates only {@code role}; batting order/eligibility are unaffected. */
    MatchSideDto updatePlayerRole(
            Authentication authentication,
            UUID clubId,
            UUID matchId,
            UUID sideId,
            UUID playerProfileId,
            UpdateMatchSidePlayerRequest request);

    /**
     * Removes the player from the selection, clearing him as captain, keeper or twelfth man and
     * compacting positions. An announced side is un-announced (040) unless {@code keepAnnounced}
     * (the Release action of 076).
     */
    MatchSideDto removePlayer(
            Authentication authentication,
            UUID clubId,
            UUID matchId,
            UUID sideId,
            UUID playerProfileId,
            boolean keepAnnounced);

    /**
     * Sets the full batting order: the listed, distinct, selected players (at most the match's
     * batting places) get positions 1..k in list order; selected players not listed get none. The
     * twelfth man may be listed, which un-designates him.
     */
    MatchSideDto reorderPlayers(
            Authentication authentication,
            UUID clubId,
            UUID matchId,
            UUID sideId,
            ReorderMatchSidePlayersRequest request);

    /**
     * Marks a side's Playing XI as final/shared. Throws {@link
     * com.cricketlegend.exception.ValidationException} (400) if the side has no players yet, and
     * {@link com.cricketlegend.exception.SelectionIncompleteException} (400) if players lack a batting
     * position or the side is over its limits (docs/specs/076-team-selection.md section 8) — see
     * docs/specs/040-announce-team.md.
     */
    MatchSideDto announce(Authentication authentication, UUID clubId, UUID matchId, UUID sideId);

    /** Clears the announced flag. Always succeeds if the side exists — no precondition. */
    MatchSideDto unannounce(Authentication authentication, UUID clubId, UUID matchId, UUID sideId);
}
