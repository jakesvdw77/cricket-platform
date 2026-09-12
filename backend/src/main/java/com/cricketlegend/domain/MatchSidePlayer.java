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
 * (match_side_id, batting_order)} (no two players sharing a slot). Added only after squad
 * membership/cap/age-eligibility validation at the service layer — see
 * docs/specs/029-league-management.md's MatchSide/MatchSidePlayer business rules.
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

    @Column(name = "batting_order", nullable = false)
    private int battingOrder;

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
