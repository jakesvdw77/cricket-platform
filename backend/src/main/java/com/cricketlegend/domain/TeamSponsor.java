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
 * A many-to-many join between {@link Team} and docs/specs/023-sponsors.md's existing {@link
 * Sponsor} — bare join, no {@code role}/no active flag, mirroring {@link SectionContact} exactly
 * (a dedicated join row, plain {@code UUID} FK columns, no JPA relationship navigation; unlinking
 * is a real row delete since a join row carries no independent business meaning once removed).
 * Unique on {@code (team_id, sponsor_id)} at the DB level ({@code
 * db/changelog/v1/019-add-team-profile.sql}). See docs/specs/027-team-profile.md.
 */
@Entity
@Table(name = "team_sponsor")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TeamSponsor {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "team_id", nullable = false)
    private UUID teamId;

    @Column(name = "sponsor_id", nullable = false)
    private UUID sponsorId;

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
