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
 * One squad member's current status against a {@link MatchAvailabilityPoll} — unique on {@code
 * (poll_id, player_profile_id)}, an upsert rather than an append-only log (a repeat write from the
 * same {@link #playerProfileId} updates the existing row). Deliberately keyed by {@link
 * #playerProfileId}, not any session-derived identity, so a future login-aware write path can
 * adopt these same rows with zero schema rework. {@link #updatedBy} is always {@code null} in this
 * pass — the public write path has no authenticated identity to attribute it to — kept nullable
 * rather than omitted for that same forward-compatibility reason. See
 * docs/specs/032-match-availability-polls.md.
 */
@Entity
@Table(name = "player_availability")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlayerAvailability {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "poll_id", nullable = false)
    private UUID pollId;

    @Column(name = "player_profile_id", nullable = false)
    private UUID playerProfileId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AvailabilityStatus status;

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
