package com.cricketlegend.dto;

import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ScorecardStatus;

/** docs/specs/101: how complete one ours side's scorecard is (a derby reports each ours side). */
public record ScorecardSideStatusDto(ResultSide side, ScorecardStatus status) {
}
