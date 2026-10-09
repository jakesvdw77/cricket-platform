package com.cricketlegend.repository;

import java.util.UUID;

/** A player profile id with the number of started matches they were selected for (docs/specs/088). */
public interface PlayerGamesView {

    UUID getPlayerProfileId();

    long getGames();
}
