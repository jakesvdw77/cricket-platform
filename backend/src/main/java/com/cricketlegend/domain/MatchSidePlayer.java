package com.cricketlegend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
 * One player in a {@link MatchSide}'s ordered batting line-up, tagged with a {@link PlayingRole}.
 * Unique on {@code (match_side_id, player_profile_id)} (no duplicate add) and {@code
 * (match_side_id, batting_order)} (no two players sharing a slot). Added only after the
 * pool-based selection rules (pool membership, age eligibility, availability, caps) pass at the
 * service layer — see docs/specs/076-team-selection.md, which superseded the squad-membership
 * validation of docs/specs/029-league-management.md.
 */
@Entity
@Table(name = "match_side_player")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MatchSidePlayer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "match_side_id", nullable = false)
    private UUID matchSideId;

    @Column(name = "player_profile_id", nullable = false)
    private UUID playerProfileId;

    /** Null while the player is selected but has no batting position yet (docs/specs/076-team-selection.md). */
    @Column(name = "batting_order")
    private Integer battingOrder;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PlayingRole role;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
