-- backend/src/main/resources/db/changelog/v1/016-add-sponsor-contact.sql
CREATE TABLE sponsor_contact (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id  UUID NOT NULL REFERENCES sponsor(id),
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

CREATE INDEX ix_sponsor_contact_sponsor ON sponsor_contact(sponsor_id);

CREATE UNIQUE INDEX ux_sponsor_contact_primary ON sponsor_contact(sponsor_id) WHERE is_primary AND active;
