package com.cricketlegend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A club's organisation type, branding, address, and contact details — 1:1 with {@link Club},
 * mirroring docs/specs/001-tenancy-identity-model.md's {@code ClubBranding} precedent: a
 * separate entity with its own audit trail, keeping {@code Club} itself tenancy-only rather than
 * accreting columns. See docs/specs/012-club-profile.md.
 *
 * <p>{@code clubId} is a plain shared PK/FK, set explicitly by the service — no
 * {@code @OneToOne}/{@code @MapsId} JPA relationship annotation to {@link Club}, matching this
 * codebase's existing convention of plain UUID FK columns with no entity graph navigation (see
 * {@link Club#getUpdatedBy()}, a bare {@code UUID}, not a {@code Person} reference).
 */
@Entity
@Table(name = "club_profile")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClubProfile {

    @Id
    @Column(name = "club_id")
    private UUID clubId;

    @Enumerated(EnumType.STRING)
    private ClubProfileType type;

    @Column(name = "logo_url")
    private String logoUrl;

    @Column(name = "banner_url")
    private String bannerUrl;

    @Embedded
    private Address address;

    private String email;

    private String phone;

    private String website;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @PrePersist
    void prePersist() {
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
