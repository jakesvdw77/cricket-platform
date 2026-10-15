package com.cricketlegend.exception;

import java.util.UUID;

/**
 * docs/specs/104-match-results-import-adaptors.md: the provider's match id is already imported onto another match of
 * the club. Carries that other match's id as {@code otherMatchId}. Maps to 409.
 */
public class ImportExternalIdAlreadyUsedException extends ConflictException {

    private final UUID otherMatchId;

    public ImportExternalIdAlreadyUsedException(String message, UUID otherMatchId) {
        super(message);
        this.otherMatchId = otherMatchId;
    }

    public UUID getOtherMatchId() {
        return otherMatchId;
    }
}
