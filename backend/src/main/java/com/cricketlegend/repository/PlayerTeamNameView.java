package com.cricketlegend.repository;

import java.util.UUID;

/** A player's team name in the active season (docs/specs/119: the matches screen's group label fallback). */
public interface PlayerTeamNameView {

    UUID getPlayerProfileId();

    String getTeamName();
}
