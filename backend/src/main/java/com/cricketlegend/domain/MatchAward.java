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
 * docs/specs/101: player of the match. {@link AwardType#PLAYER_OF_MATCH} is the official one (one per result, a player
 * of either side or free text); {@link AwardType#TEAM_PLAYER_OF_MATCH} is the club team's own (one per ours side).
 */
@Entity
@Table(name = "match_award")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MatchAward {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "match_result_id", nullable = false)
    private UUID matchResultId;

    @Enumerated(EnumType.STRING)
    @Column(name = "award_type", nullable = false)
    private AwardType awardType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ResultSide side;

    @Column(name = "result_player_id")
    private UUID resultPlayerId;

    @Column(name = "display_name")
    private String displayName;
}
