package com.cricketlegend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
 * docs/specs/104-match-results-import-adaptors.md: a name as an import file spelt it, remembered per club and pointing at
 * one of the club's players or teams, so the same spelling is never asked twice. Written by the server only; a
 * correction deactivates the previous row. Never crosses clubs. Opposition players have no aliases.
 */
@Entity
@Table(name = "result_name_alias")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NameAlias {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "club_id", nullable = false)
    private UUID clubId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NameAliasKind kind;

    @Column(name = "alias_normalised", nullable = false)
    private String aliasNormalised;

    @Column(name = "alias_original", nullable = false)
    private String aliasOriginal;

    @Column(name = "target_player_profile_id")
    private UUID targetPlayerProfileId;

    @Column(name = "target_team_id")
    private UUID targetTeamId;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private boolean active;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
