package com.cricketlegend.service;

import com.cricketlegend.dto.ShareSettingsDto;
import java.util.UUID;

/** A club's sharing settings. See docs/specs/114-share-result.md and docs/specs/122-league-sharing.md. */
public interface ClubShareSettingsService {

    /**
     * The club's settings; {@code initialsOnlyDefault} is false and {@code disabledFormats} an empty map when the
     * club has no profile row yet. Throws {@link com.cricketlegend.exception.NotFoundException} when the club does
     * not exist.
     */
    ShareSettingsDto get(UUID clubId);

    /**
     * Saves the settings, creating the club's profile row (with only these settings set) when there is none. A null
     * {@code disabledFormats} leaves the stored value; a value that differs from the stored one needs
     * {@code canAdminister}, otherwise Spring Security's {@code AccessDeniedException} is thrown. Throws
     * {@link com.cricketlegend.exception.ValidationException} for an unknown content type or format code, or when a
     * content type would be left with no format, and {@link com.cricketlegend.exception.NotFoundException} when the
     * club does not exist.
     */
    ShareSettingsDto put(UUID clubId, ShareSettingsDto settings, boolean canAdminister);
}
