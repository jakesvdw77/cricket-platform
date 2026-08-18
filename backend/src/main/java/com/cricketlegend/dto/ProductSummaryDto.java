package com.cricketlegend.dto;

import java.util.UUID;

/**
 * Small embeddable shape of a Product for {@link SubscriptionDto} — deliberately narrower than
 * {@link ProductDto} (a Subscription list row only needs enough to identify the plan, not its
 * full pricing/limits shape). See docs/specs/009-subscriptions.md.
 */
public record ProductSummaryDto(UUID id, String name, String code) {
}
