package com.cricketlegend.repository;

import java.time.Instant;

/** docs/specs/101: one distinct guest name with how often and when it was last used. */
public interface GuestNameView {

    String getDisplayName();

    long getUses();

    Instant getLastUsed();
}
