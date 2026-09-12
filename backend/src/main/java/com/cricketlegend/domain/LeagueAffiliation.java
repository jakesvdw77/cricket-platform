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
 * A club's own {@link Team} entered into its own {@link League} for a {@link Season} — a bare
 * join, no {@code active} flag, mirroring {@link TeamSponsor}/{@link SectionContact}'s "a join
 * row carries no independent business meaning" posture (unlink is a real row delete). Unique on
 * {@code (league_id, team_id, season_id)} at the DB level. See
 * docs/specs/029-league-management.md.
 */
@Entity
@Table(name = "league_affiliation")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeagueAffiliation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "league_id", nullable = false)
    private UUID leagueId;

    @Column(name = "team_id", nullable = false)
    private UUID teamId;

    @Column(name = "season_id", nullable = false)
    private UUID seasonId;

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
