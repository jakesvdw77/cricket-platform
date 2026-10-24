package com.cricketlegend.repository;

import java.time.LocalDate;
import java.util.UUID;

/** A player's profile id, person id, name and date of birth (docs/specs/119: suggesting a player for a link request). */
public interface PlayerIdentityView {

    UUID getPlayerProfileId();

    UUID getPersonId();

    String getFirstName();

    String getLastName();

    LocalDate getDateOfBirth();
}
