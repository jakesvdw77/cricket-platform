package com.cricketlegend.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * The first real implementation of docs/specs/001-tenancy-identity-model.md's already-designed
 * {@code Team} shape — a leaf hanging off a {@link Section} ({@code section_id}, plain {@code
 * UUID} FK column, no JPA relationship navigation, matching {@code Section}'s own convention for
 * {@code clubId}/{@code parentSectionId}). Carries its own {@code club_id} directly (not derived
 * via {@code Section}) so the flat club-wide list endpoint can query it without a join. Adds this
 * codebase's standard audit/active-flag columns beyond {@code 001}'s original four-field sketch —
 * {@link #active} ("disable, never delete", no hard-delete branch for {@code Team}, unlike {@link
 * Section}'s one-off exception — see docs/specs/026-teams.md's Non-goals). See
 * docs/specs/026-teams.md.
 *
 * <p>{@link #abbreviation}/{@link #groundName}/{@link #socialLinks} (docs/specs/
 * 057-team-extended-profile.md) give {@code Team} the same club-facing profile shape {@link
 * League}'s own {@code 053} extension already has — every one nullable/optional, purely
 * cosmetic. {@code socialLinks} reuses the {@link SocialLink} {@code @Embeddable}/{@code
 * @ElementCollection} pattern {@link League#getSocialLinks()} already establishes, with its own
 * owning table ({@code team_social_link}).
 */
@Entity
@Table(name = "team")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Team {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "club_id", nullable = false)
    private UUID clubId;

    @Column(name = "section_id", nullable = false)
    private UUID sectionId;

    @Column(nullable = false)
    private String name;

    @Column(name = "logo_url")
    private String logoUrl;

    private String abbreviation;

    @Column(name = "ground_name")
    private String groundName;

    @ElementCollection
    @CollectionTable(name = "team_social_link", joinColumns = @JoinColumn(name = "team_id"))
    @Builder.Default
    private List<SocialLink> socialLinks = new ArrayList<>();

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
