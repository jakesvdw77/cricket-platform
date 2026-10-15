package com.cricketlegend.dto;

/**
 * docs/specs/104-match-results-import-adaptors.md: where an imported draft came from. {@code source} is {@code
 * IMPORT:<provider>} (upper case) and {@code externalId} the provider's match id, or null when the file has none. Only
 * {@code ResultService.saveImportedDraft} sets them on a result; the normal save never takes them from a client.
 */
public record ImportOrigin(String source, String externalId) {
}
