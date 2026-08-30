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
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * The first real implementation of docs/specs/001-tenancy-identity-model.md's already-designed
 * self-referential {@code Section} shape — every club structures its age groups differently, so a
 * club-admin-editable tree of arbitrary depth/branching, not a fixed level vocabulary. Many-to-one
 * with {@link Club}, and self-referential via {@link #parentSectionId} (root nodes have a {@code
 * null} parent) — both plain {@code UUID} FK columns with no JPA relationship navigation, matching
 * {@link ClubContact}'s established convention. Adds three fields {@code 001} never specified —
 * {@link #minAge}/{@link #maxAge}/{@link #gender} — optional, unenforced eligibility metadata (see
 * the spec's Non-goals: never validated against a real person). "Disable, never delete" — see
 * {@link #active}; a node can only be deactivated once every direct child is already inactive
 * (enforced in the service layer, not here — see docs/specs/025-club-structure.md's Data Model
 * Changes). See docs/specs/025-club-structure.md.
 */
@Entity
@Table(name = "section")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Section {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "club_id", nullable = false)
    private UUID clubId;

    @Column(name = "parent_section_id")
    private UUID parentSectionId;

    @Column(nullable = false)
    private String name;

    @Column(name = "min_age")
    private Integer minAge;

    @Column(name = "max_age")
    private Integer maxAge;

    @Enumerated(EnumType.STRING)
    @Column
    private Gender gender;

    @Column(nullable = false)
    private boolean active;

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
