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
 * docs/specs/101: one of our bowlers in the innings in which the other side batted. {@link #balls} is balls, never
 * decimal overs. See {@link BattingEntry} for the featured columns.
 */
@Entity
@Table(name = "bowling_entry")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BowlingEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "match_innings_id", nullable = false)
    private UUID matchInningsId;

    @Column(name = "result_player_id", nullable = false)
    private UUID resultPlayerId;

    @Column(name = "bowling_order")
    private Integer bowlingOrder;

    @Column(nullable = false)
    private int balls;

    @Column(nullable = false)
    private int maidens;

    @Column(nullable = false)
    private int runs;

    @Column(nullable = false)
    private int wickets;

    private Integer wides;

    @Column(name = "no_balls")
    private Integer noBalls;

    @Enumerated(EnumType.STRING)
    @Column(name = "featured_override")
    private FeaturedOverride featuredOverride;

    private Boolean featured;
}
