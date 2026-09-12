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
import java.time.LocalDate;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A club's own internal league/tournament/friendly fixture list — club-owned, never a true
 * cross-club/vendor-run league (this spec amends {@code 001}'s ADR-02, see docs/specs/029's
 * Problem &amp; Goals). Plain {@code UUID} club_id FK column, no JPA relationship navigation,
 * matching {@link Sponsor}/{@link Team}'s convention. {@link #minAge}/{@link #maxAge} are a
 * deliberate divergence from {@link Section#getMinAge()}/{@link Section#getMaxAge()} — ENFORCED
 * here, unlike {@code Section}'s purely descriptive fields (see the spec's Problem &amp; Goals).
 * "Disable, never delete" — see {@link #active}. See docs/specs/029-league-management.md.
 */
@Entity
@Table(name = "league")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class League {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "club_id", nullable = false)
    private UUID clubId;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LeagueSource source;

    @Column(name = "max_playing_xi_size", nullable = false)
    private int maxPlayingXiSize;

    @Column(name = "allow_substitutions", nullable = false)
    private boolean allowSubstitutions;

    @Column(name = "min_age")
    private Integer minAge;

    @Column(name = "max_age")
    private Integer maxAge;

    @Column(name = "age_cutoff_date")
    private LocalDate ageCutoffDate;

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
