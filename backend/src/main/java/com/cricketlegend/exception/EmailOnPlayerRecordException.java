package com.cricketlegend.exception;

/**
 * The verified email is already held by another Person, an under-18 player's record (docs/specs/149).
 * Maps to HTTP 409 with {@code code} EMAIL_ON_PLAYER_RECORD.
 */
public class EmailOnPlayerRecordException extends ConflictException {

    public static final String CODE = "EMAIL_ON_PLAYER_RECORD";

    public EmailOnPlayerRecordException() {
        super("This email address is already used on a player's record. Ask the club to correct it, "
                + "or sign in with a different email address.");
    }
}
