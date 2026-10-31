package com.cricketlegend.dto;

/**
 * Body of {@code POST .../commit} (docs/specs/097-import-framework.md): the revision, the confirmation token from the
 * last decisions response and the digest of the creations list the user saw. Missing values are refused by the service
 * as an invalid confirmation (409), not as bean validation.
 */
public record CommitImportRequest(int revision, String confirmationToken, String confirmedCreationsDigest) {
}
