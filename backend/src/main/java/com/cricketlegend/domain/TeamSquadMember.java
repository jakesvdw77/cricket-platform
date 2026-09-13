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
 * The persistence for a {@link Team}'s squad — season-scoped, not standing, per this spec's own
 * pre-build amendment (see docs/specs/029-league-management.md's Rollout Notes): a team's squad is
 * rebuilt each season rather than carrying over indefinitely. A real join entity, not a bare
 * {@code @ElementCollection}, matching {@link TeamSponsor}/{@link SectionContact}/{@link
 * PlayerSection}'s precedent. Unique on {@code (team_id, season_id, player_profile_id)} — the same
 * player can be (re)added independently for each season. See docs/specs/029-league-management.md.
 */
@Entity
@Table(name = "team_squad_member")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TeamSquadMember {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "team_id", nullable = false)
    private UUID teamId;

    @Column(name = "season_id", nullable = false)
    private UUID seasonId;

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
