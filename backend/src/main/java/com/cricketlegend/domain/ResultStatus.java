package com.cricketlegend.domain;

/** docs/specs/100-match-results-core.md: a result is a DRAFT until published; only PUBLISHED results count for anything. */
public enum ResultStatus {
    DRAFT,
    PUBLISHED
}
