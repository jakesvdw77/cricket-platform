package com.cricketlegend.domain;

/**
 * Lifecycle of a {@link Product}, per docs/specs/008-product-catalog.md: DRAFT -> ACTIVE via the
 * update endpoint, either -> RETIRED via the dedicated retire endpoint. One-way — no transition
 * out of RETIRED.
 */
public enum ProductStatus {
    DRAFT,
    ACTIVE,
    RETIRED
}
