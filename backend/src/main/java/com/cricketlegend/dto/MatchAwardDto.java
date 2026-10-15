package com.cricketlegend.dto;

import com.cricketlegend.domain.AwardType;
import com.cricketlegend.domain.ResultSide;
import java.util.UUID;

/**
 * docs/specs/101-match-results-our-side-scorecard.md: player of the match. {@code resultPlayerId}/{@code
 * playerClientKey} name one of our players; {@code displayName} is free text for an opposition player. {@code
 * playerName} is read-only: the resolved name shown on the card.
 */
public record MatchAwardDto(
        UUID id,
        AwardType awardType,
        ResultSide side,
        UUID resultPlayerId,
        String playerClientKey,
        String displayName,
        String playerName) {
}
