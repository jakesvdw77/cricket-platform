package com.cricketlegend.dto;

import com.cricketlegend.domain.FeaturedOverride;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultSide;
import java.util.UUID;

/**
 * docs/specs/101-match-results-our-side-scorecard.md: one bowler of our side, in the innings in which {@code
 * battingSide} (the OTHER side) batted. {@code balls} is balls, never decimal overs. See {@link BattingEntryDto} for
 * the read-only fields.
 */
public record BowlingEntryDto(
        UUID id,
        ResultSide battingSide,
        InningsKind inningsKind,
        UUID resultPlayerId,
        String playerClientKey,
        Integer bowlingOrder,
        Integer balls,
        Integer maidens,
        Integer runs,
        Integer wickets,
        Integer wides,
        Integer noBalls,
        FeaturedOverride featuredOverride,
        Boolean suggested,
        Boolean featured) {
}
