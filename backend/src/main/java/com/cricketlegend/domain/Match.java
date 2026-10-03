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
 * #leagueId} stays optional. {@link #homeTeamLogoUrl}/{@link #awayTeamLogoUrl} (nullable, per
 * docs/specs/050-league-schedule-and-fixtures.md) are meaningful only alongside the matching side's
 * free-text {@code *TeamName} — a real {@code Team}'s logo already comes from {@code Team.logoUrl}
 * resolved via {@code *TeamId} — enforced at the service layer, same posture as the id/name
 * exclusivity above. {@link #homeLeagueTeamId}/{@link #awayLeagueTeamId} (nullable, per
 * docs/specs/070-league-teams.md) reference a {@link LeagueTeam} and are only ever set alongside
 * that side's {@code *TeamName} (the denormalised copy of the league team's name/logo) — never
 * alongside a {@code *TeamId}. "Disable, never delete" — see {@link #active}. See
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

    @Column(name = "home_team_logo_url")
    private String homeTeamLogoUrl;

    @Column(name = "away_team_logo_url")
    private String awayTeamLogoUrl;

    @Column(name = "home_league_team_id")
    private UUID homeLeagueTeamId;

    @Column(name = "away_league_team_id")
    private UUID awayLeagueTeamId;

    @Column(name = "league_id")
    private UUID leagueId;

    @Column(name = "season_id", nullable = false)
    private UUID seasonId;

    @Column(name = "match_date", nullable = false)
    private Instant matchDate;

    private String venue;

    @Column(name = "scoring_url")
    private String scoringUrl;

    @Column(name = "streaming_url")
    private String streamingUrl;

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
