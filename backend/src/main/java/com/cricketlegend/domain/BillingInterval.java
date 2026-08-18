package com.cricketlegend.domain;

/**
 * How often a {@link Product}'s price is charged. See docs/specs/008-product-catalog.md — kept
 * distinct from Product.maxPeriodMonths, which is a different concept (subscription term cap).
 */
public enum BillingInterval {
    MONTHLY,
    ANNUAL
}
