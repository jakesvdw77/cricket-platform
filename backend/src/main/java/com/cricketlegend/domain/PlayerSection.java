package com.cricketlegend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * A many-to-many join between {@link PlayerProfile} and {@link Section} — an eligibility/interest
 * tag, not a squad assignment (see docs/specs/028-players.md's Non-goals: independent of {@code
 * TeamRegistration}). Bare join, mirrors {@link SectionContact} exactly: no {@link
 * #createdAt}-adjacent {@code active} flag — unlinking is a real row delete, not a soft-delete,
 * since a tag carries no independent business meaning once removed. Unique on {@code
 * (player_profile_id, section_id)} at the DB level ({@code db/changelog/v1/020-add-player.sql}).
 * See docs/specs/028-players.md.
 */
@Entity
@Table(name = "player_section")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlayerSection {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "player_profile_id", nullable = false)
    private UUID playerProfileId;

    @Column(name = "section_id", nullable = false)
    private UUID sectionId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by")
    private UUID createdBy;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
