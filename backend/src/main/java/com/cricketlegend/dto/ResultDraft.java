package com.cricketlegend.dto;

import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultDecidedBy;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.TossDecision;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/100-match-results-core.md: the canonical shape of a result being captured. The wizard builds one and PUTs
 * it; slice 104's import adapters transform provider payloads into one. Partial values are allowed (a draft is saved
 * without full validity). Compact constructor defaults: {@code decidedBy} REGULAR, {@code ballsPerOver} 6, no innings
 * as an empty list, and each innings gets its sequence, kind and all-out flag filled in (innings are kept in
 * sequence order). When an innings has an extras breakdown (docs/specs/101) and no total, the total is their sum.
 * {@code scorecard} is optional: null means "untouched" on a save, present replaces our side's whole scorecard.
 */
public record ResultDraft(
        ResultOutcomeType outcomeType,
        ResultDecidedBy decidedBy,
        ResultSide winningSide,
        ResultMarginType marginType,
        Integer marginValue,
        Integer dlsTarget,
        Integer dlsRevisedBalls,
        Integer scheduledBalls,
        Integer ballsPerOver,
        ResultSide tossWonBy,
        TossDecision tossDecision,
        UUID playingAreaId,
        String note,
        List<InningsDto> innings,
        ScorecardDto scorecard) {

    static final int DEFAULT_BALLS_PER_OVER = 6;
    private static final int REGULAR_INNINGS = 2;
    private static final int ALL_OUT_WICKETS = 10;

    public ResultDraft {
        decidedBy = decidedBy == null ? ResultDecidedBy.REGULAR : decidedBy;
        ballsPerOver = ballsPerOver == null ? DEFAULT_BALLS_PER_OVER : ballsPerOver;
        note = note == null || note.isBlank() ? null : note.trim();
        innings = completed(innings);
    }

    /** The summary-level shape of slice 100: no scorecard section. */
    public ResultDraft(
            ResultOutcomeType outcomeType, ResultDecidedBy decidedBy, ResultSide winningSide,
            ResultMarginType marginType, Integer marginValue, Integer dlsTarget, Integer dlsRevisedBalls,
            Integer scheduledBalls, Integer ballsPerOver, ResultSide tossWonBy, TossDecision tossDecision,
            UUID playingAreaId, String note, List<InningsDto> innings) {
        this(outcomeType, decidedBy, winningSide, marginType, marginValue, dlsTarget, dlsRevisedBalls, scheduledBalls,
                ballsPerOver, tossWonBy, tossDecision, playingAreaId, note, innings, null);
    }

    /** A copy carrying {@code scorecard} as its scorecard section. */
    public ResultDraft copyWithScorecard(ScorecardDto scorecard) {
        return new ResultDraft(
                outcomeType, decidedBy, winningSide, marginType, marginValue, dlsTarget, dlsRevisedBalls,
                scheduledBalls, ballsPerOver, tossWonBy, tossDecision, playingAreaId, note, innings, scorecard);
    }

    /** A copy with the field and scheduled length filled in when the draft left them empty. */
    public ResultDraft withDefaults(UUID defaultPlayingAreaId, Integer defaultScheduledBalls) {
        return new ResultDraft(
                outcomeType, decidedBy, winningSide, marginType, marginValue, dlsTarget, dlsRevisedBalls,
                scheduledBalls == null ? defaultScheduledBalls : scheduledBalls, ballsPerOver, tossWonBy,
                tossDecision, playingAreaId == null ? defaultPlayingAreaId : playingAreaId, note, innings, scorecard);
    }

    private static List<InningsDto> completed(List<InningsDto> given) {
        if (given == null || given.isEmpty()) {
            return List.of();
        }
        List<InningsDto> result = new ArrayList<>();
        for (int index = 0; index < given.size(); index++) {
            InningsDto i = given.get(index);
            Integer sequence = i.sequence() != null ? i.sequence() : index + 1;
            InningsKind kind = i.kind() != null
                    ? i.kind()
                    : (sequence <= REGULAR_INNINGS ? InningsKind.REGULAR : InningsKind.SUPER_OVER);
            Boolean allOut = i.allOut() != null
                    ? i.allOut()
                    : (i.wickets() == null ? null : i.wickets() >= ALL_OUT_WICKETS);
            Integer extras = i.extras() == null && i.hasExtrasBreakdown() ? Integer.valueOf(i.extrasBreakdownTotal())
                    : i.extras();
            result.add(new InningsDto(
                    sequence, kind, i.battingSide(), i.runs(), i.wickets(), i.balls(), extras, allOut,
                    i.oversDisplay(), i.wides(), i.noBalls(), i.byes(), i.legByes(), i.penaltyRuns(),
                    i.nonBowlerWickets()));
        }
        result.sort(Comparator.comparing(InningsDto::sequence));
        return List.copyOf(result);
    }
}
