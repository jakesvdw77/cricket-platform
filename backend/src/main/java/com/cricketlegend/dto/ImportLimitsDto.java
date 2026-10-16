package com.cricketlegend.dto;

import com.cricketlegend.service.adaptor.ResultImportLimits;

/** docs/specs/104-match-results-import-adaptors.md: the import size caps, so the UI never hard-codes them. */
public record ImportLimitsDto(
        int maxPasteCharacters,
        long maxFileBytes,
        int maxPlayersPerSide,
        int maxRegularInnings,
        int maxNameLength,
        int maxReportedErrors) {

    public static ImportLimitsDto current() {
        return new ImportLimitsDto(
                ResultImportLimits.MAX_PASTE_CHARACTERS,
                ResultImportLimits.GLOBAL_MAX_FILE_BYTES,
                ResultImportLimits.MAX_PLAYERS_PER_SIDE,
                ResultImportLimits.MAX_REGULAR_INNINGS,
                ResultImportLimits.MAX_NAME_LENGTH,
                ResultImportLimits.MAX_REPORTED_ERRORS);
    }
}
