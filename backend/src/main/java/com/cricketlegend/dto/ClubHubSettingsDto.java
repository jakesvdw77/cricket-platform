package com.cricketlegend.dto;

/**
 * A club's Player Hub Club info switches, used for both the request and the response of
 * {@code /api/v1/manage/clubs/{clubId}/hub-settings} (docs/specs/148-player-hub-club-info.md). The directory phone and
 * email switches can only be on while the directory switch is on.
 */
public record ClubHubSettingsDto(
        boolean identityShown,
        boolean contactShown,
        boolean linksShown,
        boolean logosShown,
        boolean logoDownloadAllowed,
        boolean directoryShown,
        boolean directoryPhoneShown,
        boolean directoryEmailShown) {
}
