package com.cricketlegend.exception;

/** Missing, expired, tampered or wrong-scope public token. Maps to HTTP 401. */
public class InvalidPublicTokenException extends RuntimeException {
    public InvalidPublicTokenException(String message) {
        super(message);
    }
}
