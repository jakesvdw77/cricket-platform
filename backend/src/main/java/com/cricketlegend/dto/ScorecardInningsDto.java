package com.cricketlegend.dto;

import com.cricketlegend.domain.ResultSide;

/**
 * docs/specs/101-match-results-our-side-scorecard.md: read-only view of an innings' extras breakdown and non-bowler
 * wickets as the scorecard read reports them (they are written through {@link InningsDto} on the result).
 */
public record ScorecardInningsDto(
        ResultSide battingSide,
        Integer wides,
        Integer noBalls,
        Integer byes,
        Integer legByes,
        Integer penaltyRuns,
        Integer extras,
        Integer nonBowlerWickets) {
}
