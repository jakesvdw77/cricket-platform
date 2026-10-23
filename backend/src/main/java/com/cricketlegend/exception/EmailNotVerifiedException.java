package com.cricketlegend.exception;

/** The caller's token has no verified email (docs/specs/119). Maps to HTTP 403 with {@code code} EMAIL_NOT_VERIFIED. */
public class EmailNotVerifiedException extends RuntimeException {

    public static final String CODE = "EMAIL_NOT_VERIFIED";

    public EmailNotVerifiedException() {
        super("Verify your email to continue.");
    }
}
