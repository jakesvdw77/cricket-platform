package com.cricketlegend.dto;

import com.cricketlegend.domain.ResultDecidedBy;
import com.cricketlegend.domain.ResultDetailLevel;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultStatus;
import com.cricketlegend.domain.TossDecision;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/100-match-results-core.md: a stored result with its innings in sequence order. {@code outcomeType} is
 * null only on a draft. {@code playingAreaName} is the chosen field's name (null with no field). All run, wicket and
 * length figures are balls-based; see {@link InningsDto}.
 */
public record MatchResultDto(
        UUID id,
        UUID clubId,
        UUID matchId,
        ResultStatus status,
        ResultDetailLevel detailLevel,
        ResultOutcomeType outcomeType,
        ResultDecidedBy decidedBy,
        ResultSide winningSide,
        ResultMarginType marginType,
        Integer marginValue,
        Integer dlsTarget,
        Integer dlsRevisedBalls,
        Integer scheduledBalls,
        int ballsPerOver,
        ResultSide tossWonBy,
        TossDecision tossDecision,
        UUID playingAreaId,
        String playingAreaName,
        String note,
        String source,
        String externalId,
        Instant publishedAt,
        UUID publishedBy,
        Instant createdAt,
        Instant updatedAt,
        UUID updatedBy,
        List<InningsDto> innings) {

    /** A copy carrying the chosen field's name. */
    public MatchResultDto withPlayingAreaName(String name) {
        return new MatchResultDto(
                id, clubId, matchId, status, detailLevel, outcomeType, decidedBy, winningSide, marginType, marginValue,
                dlsTarget, dlsRevisedBalls, scheduledBalls, ballsPerOver, tossWonBy, tossDecision, playingAreaId, name,
                note, source, externalId, publishedAt, publishedBy, createdAt, updatedAt, updatedBy, innings);
    }
}
