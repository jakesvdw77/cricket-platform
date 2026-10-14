package com.cricketlegend.dto;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.FeaturedOverride;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultSide;
import java.util.UUID;

/**
 * docs/specs/101-match-results-our-side-scorecard.md: one batter of our side. The entry belongs to the regular innings
 * in which {@code battingSide} batted ({@code inningsKind} defaults to REGULAR; SUPER_OVER is refused). {@code
 * position} is the actual batting order. {@code suggested} and {@code featured} are read-only: the rules' suggestion
 * and the effective value (frozen at publish); the manager writes only {@code featuredOverride}.
 *
 * <p>{@code bowlerPlayerId} and {@code fielderPlayerId} name the dismissal's bowler and fielder: the {@code id} of a
 * player already on the scorecard, or the {@code clientKey} of a new player in the same body, or null. They must be
 * players of the fielding side of the innings, and only where {@code howOut} allows them. On read they are ids.
 */
public record BattingEntryDto(
        UUID id,
        ResultSide battingSide,
        InningsKind inningsKind,
        UUID resultPlayerId,
        String playerClientKey,
        Integer position,
        DismissalType howOut,
        Integer runs,
        Integer balls,
        Integer fours,
        Integer sixes,
        String bowlerPlayerId,
        String fielderPlayerId,
        FeaturedOverride featuredOverride,
        Boolean suggested,
        Boolean featured) {
}
