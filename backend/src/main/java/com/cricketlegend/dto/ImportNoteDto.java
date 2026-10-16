package com.cricketlegend.dto;

import java.util.List;

/**
 * docs/specs/104-match-results-import-adaptors.md: one thing the import wants the manager to know. {@code code} is a
 * stable upper-case reason clients may branch on, {@code section} says where in the document it arose ({@code
 * match}, {@code teams}, {@code players}, {@code innings[0]}, {@code awards}). For a name: {@code fileText} is what
 * the file said, {@code candidateName} who it became, {@code level} how firmly, and {@code suggestions} the ranked
 * closest players for an unresolved name.
 */
public record ImportNoteDto(
        String code,
        ImportNoteSeverity severity,
        String section,
        String message,
        String fileText,
        String candidateName,
        ImportExactness level,
        List<ImportNoteSuggestionDto> suggestions) {

    public ImportNoteDto {
        suggestions = suggestions == null ? List.of() : List.copyOf(suggestions);
    }

    public static ImportNoteDto of(String code, ImportNoteSeverity severity, String section, String message) {
        return new ImportNoteDto(code, severity, section, message, null, null, null, List.of());
    }
}
