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
 * One player's current status against a {@link SectionAvailabilityWindow} — mirrors {@link
 * PlayerAvailability}'s exact shape field-for-field, reusing {@link AvailabilityStatus} unmodified.
 * Unique on {@code (window_id, player_profile_id)}, upsert semantics, identical to {@link
 * PlayerAvailability}. {@link #updatedBy} is always {@code null} in this pass — same reasoning as
 * {@link PlayerAvailability#getUpdatedBy()}, the public write path has no authenticated identity to
 * attribute it to. See docs/specs/063-section-availability-and-flexible-squads.md.
 */
@Entity
@Table(name = "section_availability_response")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SectionAvailabilityResponse {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "window_id", nullable = false)
    private UUID windowId;

    @Column(name = "player_profile_id", nullable = false)
    private UUID playerProfileId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AvailabilityStatus status;

    /** Who wrote this answer; a manager write resets it to MANAGER (077). */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private AnswerSource source = AnswerSource.MANAGER;

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
