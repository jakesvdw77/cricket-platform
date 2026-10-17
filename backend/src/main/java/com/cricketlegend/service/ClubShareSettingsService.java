package com.cricketlegend.service;

import com.cricketlegend.dto.ShareSettingsDto;
import java.util.UUID;

/** A club's result sharing settings. See docs/specs/114-share-result.md. */
public interface ClubShareSettingsService {

    /**
     * The club's settings; {@code initialsOnlyDefault} is false when the club has no profile row yet. Throws
     * {@link com.cricketlegend.exception.NotFoundException} when the club does not exist.
     */
    ShareSettingsDto get(UUID clubId);

    /**
     * Saves the settings, creating the club's profile row (with only this flag set) when there is none. Throws
     * {@link com.cricketlegend.exception.NotFoundException} when the club does not exist.
     */
    ShareSettingsDto put(UUID clubId, ShareSettingsDto settings);
}
