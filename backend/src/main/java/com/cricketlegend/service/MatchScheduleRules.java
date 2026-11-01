package com.cricketlegend.service;

import com.cricketlegend.dto.ScheduleFindingDto;
import com.cricketlegend.exception.ScheduleRuleException;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * The one place the scheduling and duplicate rules of a single match are evaluated, for every route that saves a match
 * (docs/specs/132-match-scheduling-rules.md): manual create and edit, reschedule, reactivate and the batch the import
 * commits through. It wraps the pure rules of the league schedule import (own team overlap, venue clash, match
 * identity), so a manual save and an import cannot disagree. Inactive matches are ignored in every comparison.
 */
public interface MatchScheduleRules {

    /**
     * The match as it would be saved. A side is an own team ({@code *TeamId}), a league team ({@code *LeagueTeamId}) or
     * free text; {@code *Name} is the displayed name (null for an own team, whose name is read).
     */
    record Candidate(
            UUID leagueId,
            UUID seasonId,
            Instant start,
            String venue,
            UUID homeTeamId,
            UUID homeLeagueTeamId,
            String homeName,
            UUID awayTeamId,
            UUID awayLeagueTeamId,
            String awayName) {}

    /** Findings (errors first) for one candidate against the club's active matches; {@code excludeMatchId} is skipped. */
    List<ScheduleFindingDto> check(UUID clubId, Candidate candidate, UUID excludeMatchId);

    /**
     * As {@link #check(UUID, Candidate, UUID)}; {@code checkPastDate} false leaves out PAST_DATE (an edit that did not
     * change the date or time of the match).
     */
    List<ScheduleFindingDto> check(UUID clubId, Candidate candidate, UUID excludeMatchId, boolean checkPastDate);

    /** As {@link #check} for a whole batch in one read; each candidate also sees the ones before it. */
    List<List<ScheduleFindingDto>> checkBatch(UUID clubId, List<Candidate> candidates);

    /**
     * Passes when there is no finding, or when there is no error and every warning code is in {@code acknowledged};
     * otherwise throws {@link ScheduleRuleException} carrying every finding.
     */
    void enforce(List<ScheduleFindingDto> findings, Collection<String> acknowledged);
}
