package com.cricketlegend.exception;

/**
 * An uploaded file's content type isn't in {@code MediaServiceImpl}'s fixed image allowlist.
 * Maps to HTTP 400 via its ValidationException base — see docs/standards/backend.md.
 */
public class UnsupportedMediaTypeException extends ValidationException {
    public UnsupportedMediaTypeException(String message) {
        super(message);
    }
}
