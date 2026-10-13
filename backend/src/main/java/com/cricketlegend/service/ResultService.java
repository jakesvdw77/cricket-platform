package com.cricketlegend.service;

import com.cricketlegend.dto.MatchDto;
import com.cricketlegend.dto.MatchFilterOptionsDto;
import com.cricketlegend.dto.MatchResultDto;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ResultListCriteria;
import com.cricketlegend.dto.ResultListItemDto;
import com.cricketlegend.dto.ResultValidationDto;
import com.cricketlegend.dto.ResultsSummaryDto;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/100-match-results-core.md: capture, validate, publish and list match results. Any club manager who can
 * reach the match may capture and publish (the Matches per-match section gate applies, so a section-scoped manager
 * only touches results of matches in their sections). There is no clock rule: any active match without a result can
 * have one captured, past or future. A result is a draft until published; a published result cannot be edited or
 * deleted until unpublished. Every method here is a manager path; the publish gate for other roles is {@code
 * ResultVisibility}.
 */
public interface ResultService {

    /**
     * The Results list: the club's matches that have a result (draft or published), through the same filter, section
     * and sort pipeline as the Matches list (default sort {@code matchDate} descending), each with its result.
     */
    Page<ResultListItemDto> list(Authentication authentication, UUID clubId, ResultListCriteria criteria, Pageable pageable);

    /**
     * Active matches with no result, newest first, for the capture picker; those up to the end of today unless {@code
     * includeUpcoming}. Uses the date, section, league, season, team and search filters of {@code criteria}.
     */
    Page<MatchDto> awaiting(
            Authentication authentication, UUID clubId, ResultListCriteria criteria, boolean includeUpcoming, Pageable pageable);

    /** The Results counters for the same filters; each equals the list's total with that {@code focus}. */
    ResultsSummaryDto summary(Authentication authentication, UUID clubId, ResultListCriteria criteria);

    /** The Matches filter options for the section, league, season and team pickers. */
    MatchFilterOptionsDto filterOptions(Authentication authentication, UUID clubId, ResultListCriteria criteria);

    /** The match's result, any status; 404 when there is none. */
    MatchResultDto get(Authentication authentication, UUID clubId, UUID matchId);

    /**
     * Creates or replaces the draft. Enforces structural validity only (a draft is saved incomplete). Defaults the
     * field from the match and the scheduled length from the league's playing conditions when the draft leaves them
     * empty. 409 {@code ResultPublishedException} when published, {@code MatchNotCapturableException} when the match is
     * inactive.
     */
    MatchResultDto upsertDraft(Authentication authentication, UUID clubId, UUID matchId, ResultDraft draft);

    /** Dry run of {@code draft} (or the stored result when {@code null}); writes nothing. */
    ResultValidationDto validate(Authentication authentication, UUID clubId, UUID matchId, ResultDraft draft);

    /**
     * Re-validates the stored draft: errors give a 400 {@code InvalidResultException}; warnings need {@code
     * acknowledgedWarnings}. Then marks it published.
     */
    MatchResultDto publish(Authentication authentication, UUID clubId, UUID matchId, boolean acknowledgedWarnings);

    /** Back to draft; everything derived follows. */
    MatchResultDto unpublish(Authentication authentication, UUID clubId, UUID matchId);

    /** Deletes a draft; a published result must be unpublished first. */
    void deleteDraft(Authentication authentication, UUID clubId, UUID matchId);
}
