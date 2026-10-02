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
 * The per-fixture squad pool for a match covered by a group availability poll — used instead
 * of {@link TeamSquadMember}'s season squad for such a match (docs/specs/064). Starts empty per
 * match, no pre-seeding. {@link #teamId} must equal this match's own {@code homeTeamId}/{@code
 * awayTeamId}, and the match must be covered by a group poll for that team, enforced at the
 * service layer.
 * {@link #sectionAvailabilityWindowId} is resolved once at add-time from {@code (team.sectionId,
 * match.matchDate's date+day-part)} — a later reschedule leaves this pointing at the original
 * bracket, an accepted limitation (see the spec's Non-goals).
 *
 * <p>Two unique constraints, doing two different jobs: {@code (match_id, team_id,
 * player_profile_id)} (defensive, documents the simpler invariant directly) and {@code
 * (section_availability_window_id, player_profile_id)} — the Part C hard block, enforced at the
 * database level: because every row for a given match+team resolves to exactly one window, this
 * single constraint means a player can appear in at most one row across every match/team sharing
 * that window. See docs/specs/063-section-availability-and-flexible-squads.md.
 */
@Entity
@Table(name = "match_squad_member")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MatchSquadMember {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "match_id", nullable = false)
    private UUID matchId;

    @Column(name = "team_id", nullable = false)
    private UUID teamId;

    @Column(name = "section_availability_window_id", nullable = false)
    private UUID sectionAvailabilityWindowId;

    @Column(name = "player_profile_id", nullable = false)
    private UUID playerProfileId;

    @Column(name = "jersey_number")
    private Integer jerseyNumber;

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
