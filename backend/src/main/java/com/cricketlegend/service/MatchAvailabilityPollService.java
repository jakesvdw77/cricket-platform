package com.cricketlegend.service;

import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.dto.CreateMatchAvailabilityPollRequest;
import com.cricketlegend.dto.MatchAvailabilityPollDto;
import com.cricketlegend.dto.MatchAvailabilityPollResponsesDto;
import com.cricketlegend.dto.OpenAvailabilityPollDto;
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

    MatchAvailabilityPollResponsesDto getResponses(
            Authentication authentication, UUID clubId, UUID matchId, UUID pollId);

    // Admin override — set a squad member's status directly from the Availability tab, added after
    // a live review found no way for the admin to record a response relayed outside the poll link
    // (e.g. a phone call). Same not-in-squad 404 / closed-poll 409 rules as the public write path,
    // reusing the identical PollClosedException — an admin override still respects a closed poll,
    // matching this feature's own "closing a poll locks it, full stop, admin included" decision.
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
     * 403 outside the caller's own reach).
     */
    List<OpenAvailabilityPollDto> listOpenForClub(Authentication authentication, UUID clubId, UUID sectionId);
}
