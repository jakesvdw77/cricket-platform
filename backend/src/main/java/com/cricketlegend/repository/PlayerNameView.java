package com.cricketlegend.repository;

import java.util.UUID;

/** A player profile id with its person's first and last name. */
public interface PlayerNameView {

    UUID getPlayerProfileId();

    String getFirstName();

    String getLastName();
}
