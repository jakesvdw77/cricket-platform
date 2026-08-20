package com.cricketlegend.domain;

import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Links an owner (a {@link Club} today, only {@code CLUB} is validated — see
 * docs/specs/009-subscriptions.md's Non-goals) to an {@code ACTIVE} {@link Product}.
 * {@code ownerId}/{@code productId} are plain UUID columns, not JPA relationships, matching this
 * codebase's existing flat-field convention ({@link Product}, {@link Club} — neither uses
 * {@code @ManyToOne}).
 */
@Entity
@Table(name = "subscription")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Subscription {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "owner_type", nullable = false)
    private SubscriptionOwnerType ownerType;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SubscriptionStatus status;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Embedded
    @AttributeOverrides({
        @AttributeOverride(name = "firstName", column = @Column(name = "responsible_contact_first_name")),
        @AttributeOverride(name = "lastName", column = @Column(name = "responsible_contact_last_name")),
        @AttributeOverride(name = "email", column = @Column(name = "responsible_contact_email")),
        @AttributeOverride(name = "phone", column = @Column(name = "responsible_contact_phone")),
    })
    private Contact responsibleContact;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @PrePersist
    void prePersist() {
        if (ownerType == null) {
            ownerType = SubscriptionOwnerType.CLUB;
        }
        if (status == null) {
            status = SubscriptionStatus.ACTIVE;
        }
        if (startDate == null) {
            startDate = LocalDate.now();
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
