-- docs/specs/100-match-results-core.md: the result of a match (one row per match) and its innings totals. A result is a
-- DRAFT until published; only PUBLISHED results count for anything. outcome_type is nullable while DRAFT (a draft is
-- saved without full validity) and required once PUBLISHED. Overs are stored as balls, never decimal overs.
-- source / external_id / source_payload are reserved for the import adapters (slice 104): MANUAL and null until then.

CREATE TABLE match_result (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id           UUID NOT NULL REFERENCES club(id),
    match_id          UUID NOT NULL REFERENCES match(id),
    status            VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    detail_level      VARCHAR(16) NOT NULL DEFAULT 'SUMMARY',
    outcome_type      VARCHAR(16),
    decided_by        VARCHAR(16) NOT NULL DEFAULT 'REGULAR',
    winning_side      VARCHAR(8),
    margin_type       VARCHAR(8),
    margin_value      INT,
    dls_target        INT,
    dls_revised_balls INT,
    scheduled_balls   INT,
    balls_per_over    INT NOT NULL DEFAULT 6,
    toss_won_by       VARCHAR(8),
    toss_decision     VARCHAR(8),
    playing_area_id   UUID REFERENCES playing_area(id),
    note              TEXT,
    source            VARCHAR(64) NOT NULL DEFAULT 'MANUAL',
    external_id       VARCHAR(255),
    source_payload    JSONB,
    published_at      TIMESTAMPTZ,
    published_by      UUID,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by        UUID,
    CONSTRAINT ux_match_result_match UNIQUE (match_id),
    CONSTRAINT ck_match_result_status CHECK (status IN ('DRAFT', 'PUBLISHED')),
    CONSTRAINT ck_match_result_detail_level CHECK (detail_level IN ('SUMMARY', 'OUR_SIDE', 'FULL')),
    CONSTRAINT ck_match_result_outcome_type CHECK (outcome_type IS NULL
        OR outcome_type IN ('WON', 'TIE', 'DRAW', 'NO_RESULT', 'ABANDONED', 'FORFEIT')),
    CONSTRAINT ck_match_result_decided_by CHECK (decided_by IN ('REGULAR', 'DLS', 'SUPER_OVER')),
    CONSTRAINT ck_match_result_winning_side CHECK (winning_side IS NULL OR winning_side IN ('HOME', 'AWAY')),
    CONSTRAINT ck_match_result_margin_type CHECK (margin_type IS NULL OR margin_type IN ('RUNS', 'WICKETS')),
    CONSTRAINT ck_match_result_margin_value CHECK (margin_value IS NULL OR margin_value >= 0),
    CONSTRAINT ck_match_result_toss_won_by CHECK (toss_won_by IS NULL OR toss_won_by IN ('HOME', 'AWAY')),
    CONSTRAINT ck_match_result_toss_decision CHECK (toss_decision IS NULL OR toss_decision IN ('BAT', 'BOWL')),
    CONSTRAINT ck_match_result_balls_per_over CHECK (balls_per_over > 0),
    CONSTRAINT ck_match_result_published_outcome CHECK (status = 'DRAFT' OR outcome_type IS NOT NULL)
);

CREATE UNIQUE INDEX ux_match_result_source_external
    ON match_result(club_id, source, external_id)
    WHERE external_id IS NOT NULL;
CREATE INDEX ix_match_result_club_status ON match_result(club_id, status);

CREATE TABLE match_innings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_result_id UUID NOT NULL REFERENCES match_result(id) ON DELETE CASCADE,
    sequence        INT NOT NULL,
    kind            VARCHAR(16) NOT NULL DEFAULT 'REGULAR',
    batting_side    VARCHAR(8) NOT NULL,
    runs            INT NOT NULL,
    wickets         INT NOT NULL,
    balls           INT NOT NULL,
    extras          INT,
    all_out         BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT ux_match_innings_sequence UNIQUE (match_result_id, sequence),
    CONSTRAINT ck_match_innings_kind CHECK (kind IN ('REGULAR', 'SUPER_OVER')),
    CONSTRAINT ck_match_innings_batting_side CHECK (batting_side IN ('HOME', 'AWAY')),
    CONSTRAINT ck_match_innings_runs CHECK (runs >= 0),
    CONSTRAINT ck_match_innings_wickets CHECK (wickets BETWEEN 0 AND 10),
    CONSTRAINT ck_match_innings_balls CHECK (balls >= 0)
);
