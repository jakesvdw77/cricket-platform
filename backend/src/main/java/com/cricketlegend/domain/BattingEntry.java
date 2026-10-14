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
 * docs/specs/101-match-results-our-side-scorecard.md: one batter's innings for our side (including those who did not
 * bat). {@link #position} is the actual batting order; the planned order stays on {@link ResultPlayer}. {@link
 * #featured} is null on a draft and frozen at publish (cleared at unpublish); {@link #featuredOverride} is the
 * manager's edit of the suggestion. Plain UUID columns, like {@link MatchInnings}. Only the result services touch it.
 */
@Entity
@Table(name = "batting_entry")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BattingEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "match_innings_id", nullable = false)
    private UUID matchInningsId;

    @Column(name = "result_player_id", nullable = false)
    private UUID resultPlayerId;

    @Column(name = "position")
    private Integer position;

    @Enumerated(EnumType.STRING)
    @Column(name = "how_out", nullable = false)
    private DismissalType howOut;

    private Integer runs;

    private Integer balls;

    private Integer fours;

    private Integer sixes;

    @Enumerated(EnumType.STRING)
    @Column(name = "featured_override")
    private FeaturedOverride featuredOverride;

    private Boolean featured;
}
