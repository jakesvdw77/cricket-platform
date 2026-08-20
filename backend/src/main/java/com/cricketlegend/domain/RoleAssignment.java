package com.cricketlegend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One row per grant — per docs/specs/001-tenancy-identity-model.md's original design, confirmed
 * and first actually built by docs/specs/015-person-status-and-role-assignment.md. A Person can
 * and does hold multiple RoleAssignment rows at once (e.g. PLAYER in one Section and CLUB_ADMIN
 * for the whole Club) — this was never a one-role-per-person model; nothing in this entity
 * enforces or assumes otherwise.
 */
@Entity
@Table(name = "role_assignment")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoleAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // Plain FK column, no @ManyToOne — matches this codebase's existing convention
    // (Subscription.ownerId/productId, Person's own columns).
    @Column(name = "person_id", nullable = false)
    private UUID personId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RoleAssignmentRole role;

    @Enumerated(EnumType.STRING)
    @Column(name = "scope_type", nullable = false)
    private ScopeType scopeType;

    // No DB-level FK — scope_id is polymorphic across Club/Section/Team depending on scopeType
    // (and unused for PLATFORM), unlike Subscription.ownerId, which could get away with a hard FK
    // to club(id) only because CLUB is the sole owner type that exists at all. Validated at the
    // service layer once a real create path exists (the next spec) — same posture 009 already
    // established for ownerType.
    @Column(name = "scope_id")
    private UUID scopeId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
