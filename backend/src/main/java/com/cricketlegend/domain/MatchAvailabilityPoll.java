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
 * One availability poll per {@code (match, team)} — {@link #teamId} must equal the parent {@link
 * Match}'s own {@code homeTeamId}/{@code awayTeamId}, enforced at the service layer, mirroring
 * {@link MatchSide}'s identical rule. {@link #open} is this entity's own Open/Closed lifecycle,
 * deliberately NOT this codebase's usual "disable, never delete" Active/Inactive flag — there is
 * no {@code active} column here. Unique on {@code (match_id, team_id)}. See
 * docs/specs/032-match-availability-polls.md.
 */
@Entity
@Table(name = "match_availability_poll")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MatchAvailabilityPoll {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "match_id", nullable = false)
    private UUID matchId;

    @Column(name = "team_id", nullable = false)
    private UUID teamId;

    @Column(nullable = false)
    private boolean open;

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
