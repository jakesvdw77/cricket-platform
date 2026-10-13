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
import java.util.Map;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * docs/specs/100-match-results-core.md: the result of one match (unique per {@link #matchId}). A DRAFT is saved
 * without full validity ({@link #outcomeType} may be null); a PUBLISHED result has been validated. Plain UUID columns,
 * like {@link Match}. Sides are {@link ResultSide#HOME}/{@link ResultSide#AWAY}, never team ids. Only the result
 * services may read or write this table; non-manager read paths must use {@code ResultVisibility}.
 */
@Entity
@Table(name = "match_result")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MatchResult {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "club_id", nullable = false)
    private UUID clubId;

    @Column(name = "match_id", nullable = false)
    private UUID matchId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ResultStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "detail_level", nullable = false)
    private ResultDetailLevel detailLevel;

    @Enumerated(EnumType.STRING)
    @Column(name = "outcome_type")
    private ResultOutcomeType outcomeType;

    @Enumerated(EnumType.STRING)
    @Column(name = "decided_by", nullable = false)
    private ResultDecidedBy decidedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "winning_side")
    private ResultSide winningSide;

    @Enumerated(EnumType.STRING)
    @Column(name = "margin_type")
    private ResultMarginType marginType;

    @Column(name = "margin_value")
    private Integer marginValue;

    @Column(name = "dls_target")
    private Integer dlsTarget;

    @Column(name = "dls_revised_balls")
    private Integer dlsRevisedBalls;

    @Column(name = "scheduled_balls")
    private Integer scheduledBalls;

    @Column(name = "balls_per_over", nullable = false)
    private int ballsPerOver;

    @Enumerated(EnumType.STRING)
    @Column(name = "toss_won_by")
    private ResultSide tossWonBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "toss_decision")
    private TossDecision tossDecision;

    /** The field played at; defaults to the match's field when the result is created (docs/specs/099). */
    @Column(name = "playing_area_id")
    private UUID playingAreaId;

    private String note;

    /** {@code MANUAL}, or {@code IMPORT:<provider>} from slice 104. */
    @Column(nullable = false)
    private String source;

    @Column(name = "external_id")
    private String externalId;

    /** Raw provider payload kept for audit and re-mapping (slice 104); unused until then. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "source_payload", columnDefinition = "jsonb")
    private Map<String, Object> sourcePayload;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "published_by")
    private UUID publishedBy;

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
