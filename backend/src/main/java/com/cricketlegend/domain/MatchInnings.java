package com.cricketlegend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * docs/specs/100-match-results-core.md: one innings' totals of a {@link MatchResult}: 1 and 2 are the regular
 * innings, 3 and up are super overs. {@link #balls} is balls faced, never decimal overs.
 */
@Entity
@Table(name = "match_innings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MatchInnings {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "match_result_id", nullable = false)
    private UUID matchResultId;

    @Column(nullable = false)
    private int sequence;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InningsKind kind;

    @Enumerated(EnumType.STRING)
    @Column(name = "batting_side", nullable = false)
    private ResultSide battingSide;

    /** Null while the figure has not been entered (a draft may hold scorecard entries before the scores). */
    private Integer runs;

    /** Null while the figure has not been entered (a draft may hold scorecard entries before the scores). */
    private Integer wickets;

    /** Null while the figure has not been entered (a draft may hold scorecard entries before the scores). */
    private Integer balls;

    /** The stored total: the sum of the breakdown below when any part is present (docs/specs/101). */
    private Integer extras;

    private Integer wides;

    @Column(name = "no_balls")
    private Integer noBalls;

    private Integer byes;

    @Column(name = "leg_byes")
    private Integer legByes;

    @Column(name = "penalty_runs")
    private Integer penaltyRuns;

    /** Wickets not credited to a bowler in this innings when the batters are not on our scorecard (docs/specs/101). */
    @Column(name = "non_bowler_wickets")
    private Integer nonBowlerWickets;

    @Column(name = "all_out", nullable = false)
    private boolean allOut;
}
