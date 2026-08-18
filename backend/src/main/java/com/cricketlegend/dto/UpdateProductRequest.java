package com.cricketlegend.dto;

import com.cricketlegend.domain.BillingInterval;
import com.cricketlegend.domain.ProductStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;

/**
 * PUT /api/v1/platform/products/{id} payload. Same editable fields as
 * {@link CreateProductRequest}, plus status — only DRAFT/ACTIVE are valid values through this
 * path; RETIRED is rejected here (retirement is the dedicated /retire endpoint). See
 * docs/specs/008-product-catalog.md.
 *
 * <p>displayOrder is required here, unlike in {@link CreateProductRequest} — every other editable
 * field in this request is set unconditionally in {@code ProductServiceImpl.update()} (no
 * "leave unchanged" semantics anywhere else in that method), so displayOrder follows the same
 * pattern rather than introducing a one-off nullable-means-unchanged rule.
 * showAds/allowSubdomain/allowWhitelisting are required here for the same reason.
 */
public record UpdateProductRequest(
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
        @NotNull @PositiveOrZero Integer displayOrder,
        @NotNull ProductStatus status,
        @NotNull Boolean showAds,
        @NotNull Boolean allowSubdomain,
        @NotNull Boolean allowWhitelisting) {
}
