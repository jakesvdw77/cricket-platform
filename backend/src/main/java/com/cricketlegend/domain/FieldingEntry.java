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

/** docs/specs/101: one of our fielders' credits in an innings (a row exists only for a fielder with a credit). */
@Entity
@Table(name = "fielding_entry")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FieldingEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "match_innings_id", nullable = false)
    private UUID matchInningsId;

    @Column(name = "result_player_id", nullable = false)
    private UUID resultPlayerId;

    @Column(nullable = false)
    private int catches;

    @Column(nullable = false)
    private int stumpings;

    @Column(name = "run_outs", nullable = false)
    private int runOuts;

    @Enumerated(EnumType.STRING)
    @Column(name = "featured_override")
    private FeaturedOverride featuredOverride;

    private Boolean featured;
}
