package com.cricketlegend.dto;

import com.cricketlegend.domain.BillingInterval;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;

/**
 * POST /api/v1/platform/products payload. price/currency/billingInterval are deliberately left
 * un-annotated here — their requiredness is conditional on isFree and is enforced in
 * ProductServiceImpl, not bean validation. See docs/specs/008-product-catalog.md.
 *
 * <p>displayOrder is optional — {@code null} means "use the entity's default (0)", applied by
 * {@code Product}'s {@code @PrePersist} hook. showAds/allowSubdomain/allowWhitelisting follow the
 * same optional pattern — each {@code null} means "use the entity's default ({@code false})",
 * applied by the same {@code @PrePersist} hook.
 */
public record CreateProductRequest(
        @NotBlank String code,
        @NotBlank String name,
        String description,
        @NotNull Boolean isFree,
        BigDecimal price,
        String currency,
        BillingInterval billingInterval,
        @Positive Integer maxPeriodMonths,
        @Positive Integer maxSections,
        @Positive Integer maxTeams,
        @Positive Integer maxPlayers,
        @PositiveOrZero Integer displayOrder,
        Boolean showAds,
        Boolean allowSubdomain,
        Boolean allowWhitelisting) {
}
