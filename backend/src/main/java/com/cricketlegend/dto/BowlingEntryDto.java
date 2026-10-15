package com.cricketlegend.dto;

import com.cricketlegend.domain.CreditSource;
import com.cricketlegend.domain.FeaturedOverride;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultSide;
import java.util.UUID;

/**
 * docs/specs/101-match-results-our-side-scorecard.md: one bowler of our side, in the innings in which {@code
 * battingSide} (the OTHER side) batted. {@code balls} is balls, never decimal overs. See {@link BattingEntryDto} for
 * the read-only fields. {@code dots} (optional, at most {@code balls}) are dot balls. {@code wicketsSource} says whether
 * {@code wickets} are typed (MANUAL, the default) or recomputed from the dismissals on every save (DERIVED); {@code
 * derivedWickets} is read-only: what the dismissals credit this bowler, always computed.
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
        Integer dots,
        CreditSource wicketsSource,
        FeaturedOverride featuredOverride,
        Boolean suggested,
        Boolean featured,
        Integer derivedWickets) {
}
