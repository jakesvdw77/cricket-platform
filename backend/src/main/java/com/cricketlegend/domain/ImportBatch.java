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
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * One import: the upload, its normalised rows and issues ({@code payload}), the user's decisions and, once committed,
 * the audit trail. Generic across import types; the type's own parameters live in {@code scope}. The original file is
 * never stored (docs/specs/097-import-framework.md, R4). {@code payload} is nulled on expiry and 30 days after commit.
 * Plain UUID columns, no relationship navigation.
 */
@Entity
@Table(name = "import_batch")
@Getter
@Setter
@NoArgsConstructor
public class ImportBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "club_id", nullable = false, updatable = false)
    private UUID clubId;

    @Column(nullable = false, updatable = false)
    private String type;

    @Column(name = "template_version", nullable = false, updatable = false)
    private int templateVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ImportSource source = ImportSource.TEMPLATE_FILE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ImportBatchStatus status;

    @Column(name = "scope_key", nullable = false, updatable = false)
    private String scopeKey;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> scope = new HashMap<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "scope_mode")
    private ImportScopeMode scopeMode;

    @Column(name = "time_zone")
    private String timeZone;

    @Column(name = "file_name", nullable = false, updatable = false)
    private String fileName;

    @Column(name = "file_sha256", nullable = false, updatable = false)
    private String fileSha256;

    @Column(name = "rows_sha256")
    private String rowsSha256;

    @Column(name = "file_size_bytes", nullable = false, updatable = false)
    private long fileSizeBytes;

    /** Normalised rows, issues and proposals as JSON; see {@code ImportPayload}. Null once expired or retired. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> payload;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> decisions = new HashMap<>();

    @Column(nullable = false)
    private int revision;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> counts = new HashMap<>();

    @Column(name = "confirmation_digest")
    private String confirmationDigest;

    @Column(name = "token_issued_at")
    private Instant tokenIssuedAt;

    @Column(name = "last_error")
    private String lastError;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "committed_by")
    private UUID committedBy;

    @Column(name = "committed_at")
    private Instant committedAt;

    @Column(name = "deleted_by")
    private UUID deletedBy;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    /** Optimistic lock. */
    @Version
    private long version;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
