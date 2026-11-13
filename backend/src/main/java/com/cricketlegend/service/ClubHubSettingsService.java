package com.cricketlegend.service;

import com.cricketlegend.dto.ClubHubSettingsDto;
import java.util.UUID;

/** A club's Player Hub Club info switches. See docs/specs/148-player-hub-club-info.md. */
public interface ClubHubSettingsService {

    /**
     * The club's switches; the defaults (identity, contact, links and logos on, everything else off) when the club has
     * no profile row yet. Throws {@link com.cricketlegend.exception.NotFoundException} when the club does not exist.
     */
    ClubHubSettingsDto get(UUID clubId);

    /**
     * Saves the switches, creating the club's profile row (with only these settings set) when there is none. Throws
     * {@link com.cricketlegend.exception.ValidationException} when directory phone or email is on while the directory is
     * off, and {@link com.cricketlegend.exception.NotFoundException} when the club does not exist.
     */
    ClubHubSettingsDto put(UUID clubId, ClubHubSettingsDto settings);
}
