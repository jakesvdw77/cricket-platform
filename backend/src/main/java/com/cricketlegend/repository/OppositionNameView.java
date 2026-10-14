package com.cricketlegend.repository;

import java.time.Instant;

/** docs/specs/101: one distinct opposition name with how often it was used and the date of the latest fixture. */
public interface OppositionNameView {

    String getDisplayName();

    long getUses();

    Instant getLastMatchDate();
}
