package com.cricketlegend.service;

import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.dto.CreateMatchAvailabilityPollRequest;
import com.cricketlegend.dto.MatchAvailabilityPollDto;
import com.cricketlegend.dto.MatchAvailabilityPollResponsesDto;
import com.cricketlegend.dto.OpenAvailabilityPollDto;
import com.cricketlegend.dto.UpdatePollCloseTimeRequest;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/**
 * Admin surface for docs/specs/032-match-availability-polls.md, entirely under {@code
 * /api/v1/manage/clubs/{clubId}/matches/{matchId}/polls} — every method scoped to {@code clubId}
 * first, matching {@code MatchSideService}'s exact isolation posture.
 *
 * <p>Per docs/specs/035-section-scoped-access.md, every method also takes the caller's {@link
 * Authentication} — a section-scoped {@code CLUB_ADMIN} may only reach a poll whose parent {@code
 * Match} resolves to one of their own accessible sections ({@link
 * com.cricketlegend.config.AccessService#resolveMatchSectionIds}).
 */
public interface MatchAvailabilityPollService {

    List<MatchAvailabilityPollDto> list(Authentication authentication, UUID clubId, UUID matchId);

    MatchAvailabilityPollDto create(
            Authentication authentication, UUID clubId, UUID matchId, CreateMatchAvailabilityPollRequest request);

    MatchAvailabilityPollDto open(Authentication authentication, UUID clubId, UUID matchId, UUID pollId);

    MatchAvailabilityPollDto close(Authentication authentication, UUID clubId, UUID matchId, UUID pollId);

    /**
     * Sets or clears a poll's close time (docs/specs/066-poll-close-time-and-unified-cards.md) on an
     * open or closed poll; never changes {@code open}. 400 ({@code InvalidCloseTimeException}) on a
     * missing/past/after-kickoff time.
     */
    MatchAvailabilityPollDto updateCloseTime(
            Authentication authentication,
            UUID clubId,
            UUID matchId,
            UUID pollId,
            UpdatePollCloseTimeRequest request);

    /**
     * Deletes a squad poll and its {@code PlayerAvailability} rows, freeing the match for a new
     * poll of either kind (docs/specs/064-unified-availability-polls.md). Same section-scoped gate
     * as the poll's other admin endpoints.
     */
    void delete(Authentication authentication, UUID clubId, UUID matchId, UUID pollId);

    /**
     * Internal, auth-free entry point of the scheduled auto-close job: closes every poll with
     * {@code open = true AND auto_close = true AND scheduled_close_at <= now}. Idempotent.
     *
     * @return how many polls were closed
     */
    int closeDueAutoClosePolls(Instant now);

    MatchAvailabilityPollResponsesDto getResponses(
            Authentication authentication, UUID clubId, UUID matchId, UUID pollId);

    // Admin override — set a squad member's status directly from the Availability tab, added after
    // a live review found no way for the admin to record a response relayed outside the poll link
    // (e.g. a phone call). Same not-in-squad 404 rule as the public write path; unlike the public
    // path it is accepted on a closed poll (docs/specs/066: a manager correction).
    MatchAvailabilityPollResponsesDto setPlayerStatus(
            Authentication authentication,
            UUID clubId,
            UUID matchId,
            UUID pollId,
            UUID playerProfileId,
            AvailabilityStatus status);

    /**
     * Every currently-open poll across the whole club, aggregated with its match context and a
     * per-status respondent summary, sorted by the poll's own match {@code matchDate} ascending.
     * Section-aware from its first implementation per docs/specs/035-section-scoped-access.md's
     * amendment to docs/specs/034-availability-polls-dashboard.md's own draft contract: an
     * unrestricted (club-wide) caller sees every open poll; a section-scoped caller sees only
     * those whose match resolves to one of their own accessible sections. {@code sectionId}, when
     * supplied, narrows further to that section's own closure — validated via {@link
     * com.cricketlegend.config.AccessService#assertCanAdministerSection} first (404 wrong club,
     * 403 outside the caller's own reach). {@code leagueId} and {@code teamId} (docs/specs/083) narrow
     * to polls of that league's matches and that team's polls (404 for another club's league or team),
     * through the shared {@code AvailabilityPollFilter}. Polls of deactivated matches are never listed.
     */
    List<OpenAvailabilityPollDto> listOpenForClub(
            Authentication authentication, UUID clubId, UUID sectionId, UUID leagueId, UUID teamId);

    /**
     * Closed squad polls for the club, most recent match date first, capped at the 50 most recent
     * (closed history is otherwise unbounded). Same section-scope narrowing and response shape as
     * {@link #listOpenForClub}.
     */
    List<OpenAvailabilityPollDto> listClosedForClub(
            Authentication authentication, UUID clubId, UUID sectionId, UUID leagueId, UUID teamId);
}
