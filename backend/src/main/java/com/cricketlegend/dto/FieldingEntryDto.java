package com.cricketlegend.dto;

import com.cricketlegend.domain.FeaturedOverride;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultSide;
import java.util.UUID;

/**
 * docs/specs/101-match-results-our-side-scorecard.md: one fielder of our side, in the innings in which {@code
 * battingSide} (the other side) batted. See {@link BattingEntryDto} for the read-only fields.
 */
public record FieldingEntryDto(
        UUID id,
        ResultSide battingSide,
        InningsKind inningsKind,
        UUID resultPlayerId,
        String playerClientKey,
        Integer catches,
        Integer stumpings,
        Integer runOuts,
        FeaturedOverride featuredOverride,
        Boolean suggested,
        Boolean featured) {
}
