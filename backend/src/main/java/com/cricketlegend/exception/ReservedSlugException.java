package com.cricketlegend.exception;

/**
 * A Club.slug matching docs/specs/002-realm-subdomain-auth.md ADR-04's reserved-word blocklist
 * (e.g. "www", "admin"), on create or update. Maps to HTTP 400 via its ValidationException base
 * — see docs/standards/backend.md.
 */
public class ReservedSlugException extends ValidationException {
    public ReservedSlugException(String message) {
        super(message);
    }
}
