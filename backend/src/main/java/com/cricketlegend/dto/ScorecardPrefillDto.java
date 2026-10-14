package com.cricketlegend.dto;

import com.cricketlegend.domain.PlayingRole;
import com.cricketlegend.domain.ResultSide;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/101-match-results-our-side-scorecard.md: the proposed line-up for each ours side of a match, from the
 * team selection. One entry per ours side (two in a derby); empty {@code players} when no team was selected. Writes
 * nothing.
 */
public record ScorecardPrefillDto(List<Side> sides) {

    /** One ours side: its team and the players in batting order (null orders last), the 12th man last. */
    public record Side(ResultSide side, UUID teamId, String teamName, List<Player> players) {
    }

    /** {@code plannedBattingOrder} is null for a player without an order and for the 12th man. */
    public record Player(
            UUID playerProfileId,
            String firstName,
            String lastName,
            Integer plannedBattingOrder,
            PlayingRole role,
            boolean substitute) {
    }
}
