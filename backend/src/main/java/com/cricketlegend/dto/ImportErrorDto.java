package com.cricketlegend.dto;

/**
 * docs/specs/104-match-results-import-adaptors.md: one problem found in an import input, in plain English. {@code path}
 * locates it in the document (for example {@code innings[0].batting[3].howOut}, empty for the whole input); {@code code}
 * is a stable upper-case reason clients may branch on, never the message text.
 */
public record ImportErrorDto(String path, String code, String message) {
}
