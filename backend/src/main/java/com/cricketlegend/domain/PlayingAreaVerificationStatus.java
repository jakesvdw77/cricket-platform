package com.cricketlegend.domain;

/**
 * docs/specs/099-fields-directory.md: whether a platform admin has accepted a field. A manager-captured field starts
 * {@code UNVERIFIED} (usable but flagged); {@code REJECTED} fields drop out of search and cannot be newly chosen on a
 * match.
 */
public enum PlayingAreaVerificationStatus {
    UNVERIFIED,
    VERIFIED,
    REJECTED
}
