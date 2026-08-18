package com.cricketlegend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A subscription tier a platform admin defines with pricing and usage limits, so a later
 * Subscription spec can link a Club/Section to one. Platform-global, not club-scoped.
 * See docs/specs/008-product-catalog.md.
 */
@Entity
@Table(name = "product")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String code;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "is_free", nullable = false)
    private boolean isFree;

    private BigDecimal price;

    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(name = "billing_interval", nullable = false)
    private BillingInterval billingInterval;

    @Column(name = "max_period_months")
    private Integer maxPeriodMonths;

    @Column(name = "max_sections")
    private Integer maxSections;

    @Column(name = "max_teams")
    private Integer maxTeams;

    @Column(name = "max_players")
    private Integer maxPlayers;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProductStatus status;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    /**
     * Boxed (not primitive {@code boolean}), unlike {@link #isFree}, deliberately: these three
     * fields are optional on {@code CreateProductRequest} (mirroring {@link #displayOrder}'s
     * "omit means use the default" contract), so the mapped-in value can be {@code null} before
     * this entity's {@code @PrePersist} hook resolves it to {@code false}. A primitive
     * {@code boolean} field would NPE unboxing that {@code null} the moment MapStruct's generated
     * code calls the builder/setter. This also sidesteps the {@link #isFree}/{@code free}
     * MapStruct bean-property-naming quirk documented on {@code ProductMapper}: Lombok only
     * rewrites a getter to drop a leading "is" when the field name itself already starts with
     * "is" (as {@code isFree} does); none of these three field names do, so their generated
     * getters/setters are the plain {@code getShowAds()}/{@code setShowAds(Boolean)} shape and
     * MapStruct's inferred property name matches the field name exactly — verified against the
     * generated {@code ProductMapperImpl}, no explicit {@code @Mapping} needed for any of them.
     */
    @Column(name = "show_ads", nullable = false)
    private Boolean showAds;

    @Column(name = "allow_subdomain", nullable = false)
    private Boolean allowSubdomain;

    @Column(name = "allow_whitelisting", nullable = false)
    private Boolean allowWhitelisting;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @PrePersist
    void prePersist() {
        if (status == null) {
            status = ProductStatus.DRAFT;
        }
        if (displayOrder == null) {
            displayOrder = 0;
        }
        if (showAds == null) {
            showAds = false;
        }
        if (allowSubdomain == null) {
            allowSubdomain = false;
        }
        if (allowWhitelisting == null) {
            allowWhitelisting = false;
        }
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
