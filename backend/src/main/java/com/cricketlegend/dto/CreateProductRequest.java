package com.cricketlegend.dto;

import com.cricketlegend.domain.BillingInterval;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * POST /api/v1/platform/products payload. price/currency/billingInterval are deliberately left
 * un-annotated here for null-ness — their requiredness is conditional on isFree and is enforced
 * in ProductServiceImpl, not bean validation. currency does carry {@code @Size(min = 3, max = 3)}
 * to match the {@code VARCHAR(3)} column — it only rejects a wrong-length non-null value, it
 * doesn't reject {@code null}, so it doesn't change the conditional-requiredness logic above. See
 * docs/specs/008-product-catalog.md.
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
        @Size(min = 3, max = 3) String currency,
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
