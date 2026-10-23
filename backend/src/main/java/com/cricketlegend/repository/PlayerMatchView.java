package com.cricketlegend.repository;

import java.util.UUID;

/** A (player profile, match) pair: one player's presence in one match, from a selection or a published result (docs/specs/088). */
public interface PlayerMatchView {

    UUID getPlayerProfileId();

    UUID getMatchId();
}
