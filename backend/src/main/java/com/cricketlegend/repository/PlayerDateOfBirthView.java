package com.cricketlegend.repository;

import java.time.LocalDate;
import java.util.UUID;

/** A player profile id with its person's date of birth (null when none is on record). */
public interface PlayerDateOfBirthView {

    UUID getPlayerProfileId();

    LocalDate getDateOfBirth();
}
