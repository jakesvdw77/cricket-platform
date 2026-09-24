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
 * A single Playing Conditions PDF document for a {@code (league, season)} pair — one row per pair
 * (unique DB constraint), a re-upload replaces {@link #documentUrl}/{@link #uploadedAt}/{@link
 * #uploadedBy} in place rather than creating a second row (no version history), the same "no
 * history, just current state" posture {@code Sponsor.logoUrl}/{@code Team.logoUrl} already have.
 * Plain {@code UUID} {@code league_id}/{@code season_id} FK columns, no JPA relationship
 * navigation, matching {@link LeagueAffiliation}'s convention. See
 * docs/specs/050-league-schedule-and-fixtures.md.
 */
@Entity
@Table(name = "league_playing_conditions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeaguePlayingConditions {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "league_id", nullable = false)
    private UUID leagueId;

    @Column(name = "season_id", nullable = false)
    private UUID seasonId;

    @Column(name = "document_url", nullable = false)
    private String documentUrl;

    @Column(name = "uploaded_at", nullable = false)
    private Instant uploadedAt;

    @Column(name = "uploaded_by")
    private UUID uploadedBy;

    @PrePersist
    void prePersist() {
        if (uploadedAt == null) {
            uploadedAt = Instant.now();
        }
    }
}
