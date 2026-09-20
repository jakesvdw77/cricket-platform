package com.cricketlegend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * One side (home or away) of a {@link Match} that's a real {@link Team} — a free-text opponent
 * side never gets one, since there's no roster in this system to select from. Unique on {@code
 * (match_id, team_id)}. {@link #captainPlayerId}/{@link #wicketKeeperPlayerId} must reference a
 * player already in this side's {@link MatchSidePlayer} rows; {@link #twelfthManPlayerId} must
 * NOT be. All validated at the service layer — see docs/specs/029-league-management.md's
 * MatchSide/MatchSidePlayer business rules.
 */
@Entity
@Table(name = "match_side")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MatchSide {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "match_id", nullable = false)
    private UUID matchId;

    @Column(name = "team_id", nullable = false)
    private UUID teamId;

    @Column(name = "captain_player_id")
    private UUID captainPlayerId;

    @Column(name = "wicket_keeper_player_id")
    private UUID wicketKeeperPlayerId;

    @Column(name = "twelfth_man_player_id")
    private UUID twelfthManPlayerId;

    @Column(name = "announced", nullable = false)
    private boolean announced;

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
