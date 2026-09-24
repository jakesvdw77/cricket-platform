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
 * A single Playing Conditions record for a {@code (league, season)} pair — one row per pair
 * (unique DB constraint), holding both the uploaded PDF document ({@link #documentUrl}/{@link
 * #uploadedAt}/{@link #uploadedBy}, "no version history", same posture as {@code
 * Sponsor.logoUrl}/{@code Team.logoUrl}) and, per docs/specs/052-league-playing-conditions.md, a
 * flat set of structured match-format/points/bonus-points fields a future results-calculation
 * feature can read programmatically. Both groups are independently optional — a row can carry
 * only a PDF, only structured fields, or both. Plain {@code UUID} {@code league_id}/{@code
 * season_id} FK columns, no JPA relationship navigation, matching {@link LeagueAffiliation}'s
 * convention.
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

    @Column(name = "document_url")
    private String documentUrl;

    @Column(name = "uploaded_at")
    private Instant uploadedAt;

    @Column(name = "uploaded_by")
    private UUID uploadedBy;

    @Column(name = "max_overs_per_innings")
    private Integer maxOversPerInnings;

    @Column(name = "powerplay_overs")
    private Integer powerplayOvers;

    @Column(name = "max_overs_per_bowler")
    private Integer maxOversPerBowler;

    @Column(name = "fielding_restrictions_notes")
    private String fieldingRestrictionsNotes;

    @Column(name = "points_for_win")
    private Integer pointsForWin;

    @Column(name = "points_for_loss")
    private Integer pointsForLoss;

    @Column(name = "points_for_draw")
    private Integer pointsForDraw;

    @Column(name = "points_for_no_result")
    private Integer pointsForNoResult;

    @Column(name = "points_for_forfeit_win")
    private Integer pointsForForfeitWin;

    @Column(name = "bonus_points_enabled", nullable = false)
    private boolean bonusPointsEnabled;

    @Column(name = "bonus_batting_overs_threshold")
    private Integer bonusBattingOversThreshold;

    @Column(name = "bonus_bowling_restriction_percentage")
    private Integer bonusBowlingRestrictionPercentage;

    @Column(name = "additional_notes")
    private String additionalNotes;

    /**
     * Only defaults {@link #uploadedAt} when {@link #documentUrl} is already set at persist time
     * — a structured-fields-only first save (no PDF ever uploaded) must not be stamped as though a
     * document exists. {@code LeaguePlayingConditionsServiceImpl.upload()} already sets {@code
     * uploadedAt} explicitly on every real upload; this hook only matters for a row's very first
     * PDF upload landing on a row already created by a prior structured-only save — see
     * docs/specs/052-league-playing-conditions.md's Data Model Changes.
     */
    @PrePersist
    void prePersist() {
        if (uploadedAt == null && documentUrl != null) {
            uploadedAt = Instant.now();
        }
    }
}
