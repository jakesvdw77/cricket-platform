package com.cricketlegend.exception;

/**
 * A playing area that is not a cricket field was chosen for a match (docs/specs/099-fields-directory.md). Maps to HTTP
 * 400 via its {@link ValidationException} base.
 */
public class PlayingAreaNotMatchableException extends ValidationException {
    public PlayingAreaNotMatchableException(String message) {
        super(message);
    }
}
