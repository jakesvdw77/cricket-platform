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
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A remembered reference match ("POLICE 1 means Police"): a proposal source for the import matcher, never an automatic
 * decision (docs/specs/097-import-framework.md, R14). Scoped to {@code (club, kind, scopeKey)} so an alias never leaks
 * across leagues; deactivated when the batch that created it is deleted.
 */
@Entity
@Table(name = "import_alias")
@Getter
@Setter
@NoArgsConstructor
public class ImportAlias {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "club_id", nullable = false, updatable = false)
    private UUID clubId;

    @Column(nullable = false, updatable = false)
    private String kind;

    @Column(name = "scope_key", nullable = false, updatable = false)
    private String scopeKey;

    @Column(name = "alias_normalised", nullable = false, updatable = false)
    private String aliasNormalised;

    @Column(name = "alias_original", nullable = false, updatable = false)
    private String aliasOriginal;

    @Column(name = "target_kind", nullable = false, updatable = false)
    private String targetKind;

    @Column(name = "target_team_id", updatable = false)
    private UUID targetTeamId;

    @Column(name = "target_name", updatable = false)
    private String targetName;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by_batch", updatable = false)
    private UUID createdByBatch;

    @Column(nullable = false)
    private boolean active = true;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
