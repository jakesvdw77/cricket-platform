package com.cricketlegend.service;

import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.dto.CreateSectionAvailabilityRoundRequest;
import com.cricketlegend.dto.SectionAvailabilityRoundDto;
import com.cricketlegend.dto.SectionAvailabilityRoundMatchDto;
import com.cricketlegend.dto.SectionAvailabilityRoundResponsesDto;
import com.cricketlegend.dto.UpdatePollCloseTimeRequest;
import com.cricketlegend.dto.UpdateSectionAvailabilityRoundDescriptionRequest;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/**
 * Admin surface for a {@code SectionAvailabilityRound} — see
 * docs/specs/063-section-availability-and-flexible-squads.md's API Contract. Per the
 * fixture-group-selection revision: {@link #create} takes an explicit {@code matchIds} selection
 * (no {@code roundDate}/{@code dayPart}), {@link #updateDescription} is new, and {@link
 * #setPlayerStatus} is now {@code windowId}-keyed rather than {@code dayPart}-keyed.
 */
public interface SectionAvailabilityRoundService {

    List<SectionAvailabilityRoundDto> list(Authentication authentication, UUID clubId, UUID sectionId, Boolean open);

    SectionAvailabilityRoundDto create(
            Authentication authentication, UUID clubId, CreateSectionAvailabilityRoundRequest request);

    SectionAvailabilityRoundDto updateDescription(
            Authentication authentication,
            UUID clubId,
            UUID roundId,
            UpdateSectionAvailabilityRoundDescriptionRequest request);

    SectionAvailabilityRoundDto open(Authentication authentication, UUID clubId, UUID roundId);

    SectionAvailabilityRoundDto close(Authentication authentication, UUID clubId, UUID roundId);

    /**
     * Sets or clears a group poll's close time (docs/specs/066-poll-close-time-and-unified-cards.md)
     * on an open or closed round; never changes {@code open}. Validated against the earliest
     * covered match kickoff; 400 ({@code InvalidCloseTimeException}) when missing/past/too late.
     */
    SectionAvailabilityRoundDto updateCloseTime(
            Authentication authentication, UUID clubId, UUID roundId, UpdatePollCloseTimeRequest request);

    /**
     * Deletes a group poll child-first (responses, window-match links, windows, the round), freeing
     * its matches and brackets (docs/specs/064-unified-availability-polls.md). also clears the
     * round's dormant {@code MatchSquadMember} rows instead of refusing (docs/specs/076-team-selection.md).
     */
    void delete(Authentication authentication, UUID clubId, UUID roundId);

    /**
     * Internal, auth-free entry point of the scheduled auto-close job: closes every round with
     * {@code open = true AND auto_close = true AND scheduled_close_at <= now}, cascading to every
     * window like a manual close. Idempotent.
     *
     * @return how many rounds were closed
     */
    int closeDueAutoClosePolls(Instant now);

    SectionAvailabilityRoundResponsesDto getResponses(Authentication authentication, UUID clubId, UUID roundId);

    List<SectionAvailabilityRoundMatchDto> getMatches(Authentication authentication, UUID clubId, UUID roundId);

    /** Admin override — mirrors {@code MatchAvailabilityPollService.setPlayerStatus} exactly. */
    SectionAvailabilityRoundResponsesDto setPlayerStatus(
            Authentication authentication,
            UUID clubId,
            UUID roundId,
            UUID playerProfileId,
            UUID windowId,
            AvailabilityStatus status);
}
