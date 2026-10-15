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
 * docs/specs/101-match-results-our-side-scorecard.md: who played for one of our sides in a result, once. A registered
 * player has {@link #playerProfileId}; a guest or borrowed player has only {@link #displayName} (the name as written,
 * kept after linking). Batting, bowling, fielding rows and awards point at this row, so a swap or a link is one update.
 * Only the result services touch it. {@link #opposition} rows are the other side's typed names.
 */
@Entity
@Table(name = "result_player")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResultPlayer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "match_result_id", nullable = false)
    private UUID matchResultId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ResultSide side;

    @Column(name = "player_profile_id")
    private UUID playerProfileId;

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "linked_by")
    private UUID linkedBy;

    @Column(name = "linked_at")
    private Instant linkedAt;

    /** Snapshot of the announced batting order when the line-up was pre-filled; never changed by edits. */
    @Column(name = "planned_batting_order")
    private Integer plannedBattingOrder;

    @Column(name = "replaced_player_profile_id")
    private UUID replacedPlayerProfileId;

    /** A substitute fielder who is not one of the eleven; not a match played. */
    @Column(nullable = false)
    private boolean substitute;

    /**
     * True for a player of the side that is not ours: a name only, never a profile, never linked, never in a statistic
     * (docs/specs/101; the table's CHECK holds the same rule).
     */
    @Column(nullable = false)
    private boolean opposition;

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

    public boolean isGuest() {
        return playerProfileId == null && !opposition;
    }
}
