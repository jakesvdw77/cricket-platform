package com.cricketlegend.dto;

import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultSide;

/**
 * docs/specs/100-match-results-core.md: one innings' totals, as sent in a {@link ResultDraft} and as read back.
 * {@code balls} is balls faced, never decimal overs; {@code oversDisplay} (e.g. {@code 36.4}) is derived on read and
 * ignored on write. On write {@code sequence}, {@code kind} and {@code allOut} may be omitted: sequence follows the
 * list position, kind follows the sequence (1 and 2 regular, then super overs), and {@code allOut} follows wickets.
 *
 * <p>docs/specs/101: the batting side's extras breakdown in runs ({@code wides} to {@code penaltyRuns}); when any part
 * is present {@code extras} is their sum (a total that disagrees is a save error), and {@code nonBowlerWickets} is the
 * count of wickets not credited to a bowler, used when the batters are not on our scorecard.
 */
public record InningsDto(
        Integer sequence,
        InningsKind kind,
        ResultSide battingSide,
        Integer runs,
        Integer wickets,
        Integer balls,
        Integer extras,
        Boolean allOut,
        String oversDisplay,
        Integer wides,
        Integer noBalls,
        Integer byes,
        Integer legByes,
        Integer penaltyRuns,
        Integer nonBowlerWickets) {

    /** The summary-level shape of slice 100: no extras breakdown. */
    public InningsDto(
            Integer sequence, InningsKind kind, ResultSide battingSide, Integer runs, Integer wickets, Integer balls,
            Integer extras, Boolean allOut, String oversDisplay) {
        this(sequence, kind, battingSide, runs, wickets, balls, extras, allOut, oversDisplay, null, null, null, null,
                null, null);
    }

    /** True when any part of the extras breakdown has been entered. */
    public boolean hasExtrasBreakdown() {
        return wides != null || noBalls != null || byes != null || legByes != null || penaltyRuns != null;
    }

    /** The sum of the breakdown (an absent part counts as 0). */
    public int extrasBreakdownTotal() {
        return zero(wides) + zero(noBalls) + zero(byes) + zero(legByes) + zero(penaltyRuns);
    }

    private static int zero(Integer value) {
        return value == null ? 0 : value;
    }
}
