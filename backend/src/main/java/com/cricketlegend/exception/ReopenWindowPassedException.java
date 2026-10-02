package com.cricketlegend.exception;

/**
 * A manual reopen of an availability poll (squad poll or group poll) was attempted at or after its
 * automatic close time — reopening is only allowed until then, otherwise the auto-close job would
 * immediately undo it. Maps to HTTP 409 via its {@link ConflictException} base. See
 * docs/specs/064-unified-availability-polls.md.
 */
public class ReopenWindowPassedException extends ConflictException {
    public ReopenWindowPassedException(String message) {
        super(message);
    }
}
