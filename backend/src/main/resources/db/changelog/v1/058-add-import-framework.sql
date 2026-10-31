-- docs/specs/097-import-framework.md: the generic import framework. One batch per upload (state, normalised rows and
-- decisions in jsonb), what a committed batch created or updated (basis of undo and audit), and remembered reference
-- matches. Hash columns are VARCHAR(64) (hex SHA-256) so Hibernate's schema validation sees a plain string column.

CREATE TABLE import_batch (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id              UUID NOT NULL REFERENCES club(id),
    type                 VARCHAR(64)  NOT NULL,
    template_version     INT          NOT NULL,
    source               VARCHAR(24)  NOT NULL DEFAULT 'TEMPLATE_FILE',
    status               VARCHAR(16)  NOT NULL,
    scope_key            VARCHAR(255) NOT NULL,
    scope                JSONB        NOT NULL,
    scope_mode           VARCHAR(16),
    time_zone            VARCHAR(64),
    file_name            VARCHAR(255) NOT NULL,
    file_sha256          VARCHAR(64)  NOT NULL,
    rows_sha256          VARCHAR(64),
    file_size_bytes      BIGINT       NOT NULL,
    payload              JSONB,
    decisions            JSONB        NOT NULL DEFAULT '{}',
    revision             INT          NOT NULL DEFAULT 0,
    counts               JSONB        NOT NULL DEFAULT '{}',
    confirmation_digest  VARCHAR(64),
    token_issued_at      TIMESTAMPTZ,
    last_error           VARCHAR(1000),
    created_by           UUID         NOT NULL,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at           TIMESTAMPTZ,
    committed_by         UUID,
    committed_at         TIMESTAMPTZ,
    deleted_by           UUID,
    deleted_at           TIMESTAMPTZ,
    version              BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT ck_import_batch_status CHECK (status IN ('PREVIEW', 'COMMITTED', 'DISCARDED', 'EXPIRED', 'DELETED')),
    CONSTRAINT ck_import_batch_source CHECK (source IN ('TEMPLATE_FILE', 'AI_TRANSFORM')),
    CONSTRAINT ck_import_batch_scope_mode CHECK (scope_mode IS NULL OR scope_mode IN ('OURS_ONLY', 'ALL'))
);
CREATE INDEX ix_import_batch_club_type ON import_batch(club_id, type, status);
CREATE INDEX ix_import_batch_scope ON import_batch(club_id, scope_key, created_at DESC);
CREATE INDEX ix_import_batch_file ON import_batch(club_id, type, file_sha256);
CREATE INDEX ix_import_batch_rows ON import_batch(club_id, type, rows_sha256);

CREATE TABLE import_batch_entity (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id     UUID         NOT NULL REFERENCES import_batch(id),
    entity_type  VARCHAR(48)  NOT NULL,
    entity_id    UUID         NOT NULL,
    action       VARCHAR(16)  NOT NULL DEFAULT 'CREATED',
    row_number   INT,
    previous     JSONB,
    detail       JSONB,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_import_batch_entity_action CHECK (action IN ('CREATED', 'UPDATED'))
);
CREATE INDEX ix_import_batch_entity_batch ON import_batch_entity(batch_id);
CREATE INDEX ix_import_batch_entity_entity ON import_batch_entity(entity_type, entity_id);

CREATE TABLE import_alias (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id           UUID         NOT NULL REFERENCES club(id),
    kind              VARCHAR(32)  NOT NULL,
    scope_key         VARCHAR(255) NOT NULL,
    alias_normalised  VARCHAR(255) NOT NULL,
    alias_original    VARCHAR(255) NOT NULL,
    target_kind       VARCHAR(32)  NOT NULL,
    target_team_id    UUID,
    target_name       VARCHAR(255),
    created_by        UUID         NOT NULL,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by_batch  UUID REFERENCES import_batch(id),
    active            BOOLEAN      NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX ux_import_alias ON import_alias(club_id, kind, scope_key, alias_normalised) WHERE active;
