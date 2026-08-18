package com.cricketlegend.dto;

import com.cricketlegend.domain.BillingInterval;
import com.cricketlegend.domain.ProductStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Full read shape of a Product, for the platform_admin catalogue screen.
 * See docs/specs/008-product-catalog.md.
 */
public record ProductDto(
        UUID id,
        String code,
        String name,
        String description,
        boolean isFree,
        BigDecimal price,
        String currency,
        BillingInterval billingInterval,
        Integer maxPeriodMonths,
        Integer maxSections,
        Integer maxTeams,
        Integer maxPlayers,
        ProductStatus status,
        Integer displayOrder,
        boolean showAds,
        boolean allowSubdomain,
        boolean allowWhitelisting,
        Instant createdAt,
        Instant updatedAt,
        UUID updatedBy) {
}
