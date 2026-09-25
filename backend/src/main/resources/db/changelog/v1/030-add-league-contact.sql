-- backend/src/main/resources/db/changelog/v1/030-add-league-contact.sql
CREATE TABLE league_contact (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id   UUID NOT NULL REFERENCES league(id),
    first_name  VARCHAR(255) NOT NULL,
    last_name   VARCHAR(255) NOT NULL,
    email       VARCHAR(255) NOT NULL,
    phone       VARCHAR(32) NOT NULL,
    role        VARCHAR(128) NOT NULL,
    is_primary  BOOLEAN NOT NULL DEFAULT false,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID
);

CREATE INDEX ix_league_contact_league ON league_contact(league_id);

CREATE UNIQUE INDEX ux_league_contact_primary ON league_contact(league_id) WHERE is_primary AND active;
