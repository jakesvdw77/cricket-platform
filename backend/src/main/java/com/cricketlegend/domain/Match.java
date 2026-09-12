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
 * A club's own scheduled fixture — deliberately doing double duty as both fixture and match
 * record (mirroring the legacy project's single-entity approach). {@link #clubId} is ALWAYS the
 * acting/creating club from the URL, NEVER derived from {@link #homeTeamId}'s own club — a
 * deliberate, conservative call to avoid a cross-tenant ownership-assignment risk (see
 * docs/specs/029-league-management.md's dedicated Data Model Changes note). Exactly one of {@link
 * #homeTeamId}/{@link #homeTeamName} is populated, and exactly one of {@link #awayTeamId}/{@link
 * #awayTeamName} — enforced at the service layer ahead of the DB {@code CHECK} constraints. {@link
 * #seasonId} is NOT NULL (required, not optional) per this spec's own pre-build amendment — every
 * {@code MatchSide} needs an unambiguous season to resolve squad eligibility against. {@link
 * #leagueId} stays optional. "Disable, never delete" — see {@link #active}. See
 * docs/specs/029-league-management.md.
 */
@Entity
@Table(name = "match")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Match {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "club_id", nullable = false)
    private UUID clubId;

    @Column(name = "home_team_id")
    private UUID homeTeamId;

    @Column(name = "home_team_name")
    private String homeTeamName;

    @Column(name = "away_team_id")
    private UUID awayTeamId;

    @Column(name = "away_team_name")
    private String awayTeamName;

    @Column(name = "league_id")
    private UUID leagueId;

    @Column(name = "season_id", nullable = false)
    private UUID seasonId;

    @Column(name = "match_date", nullable = false)
    private Instant matchDate;

    private String venue;

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
