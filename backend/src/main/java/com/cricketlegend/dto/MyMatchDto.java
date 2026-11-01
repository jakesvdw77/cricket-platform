package com.cricketlegend.dto;

import com.cricketlegend.domain.MatchPhase;
import com.cricketlegend.domain.MatchSelectionState;
import com.cricketlegend.domain.MyMatchStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/**
 * docs/specs/135: one match for the Player Hub match page. Response only. Deliberately carries no manager-only data:
 * no other player's availability, notes, contacts, draft results or scoring/streaming links beyond the validated
 * {@code liveScore} and (live only) {@code stream}.
 */
public record MyMatchDto(
        UUID matchId,
        LocalDate date,
        LocalTime time,
        Instant startedAt,
        MatchPhase phase,
        MyMatchStatus status,
        MyMatchRefDto league,
        MyMatchRefDto season,
        String venue,
        UUID playingAreaId,
        String playingAreaName,
        BigDecimal playingAreaLatitude,
        BigDecimal playingAreaLongitude,
        BigDecimal playingAreaAccessLatitude,
        BigDecimal playingAreaAccessLongitude,
        String playingAreaAccessNote,
        MyMatchSideDto home,
        MyMatchSideDto away,
        MatchSelectionState selection,
        MyMatchAvailabilityDto availability,
        LiveScoreSource liveScore,
        MyMatchStreamDto stream,
        MyMatchResultDto result) {}
