CREATE TABLE club_contact (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id     UUID NOT NULL REFERENCES club(id),
    first_name  VARCHAR(255) NOT NULL,
    last_name   VARCHAR(255) NOT NULL,
    email       VARCHAR(255) NOT NULL,
    phone       VARCHAR(32) NOT NULL,
    role        VARCHAR(128) NOT NULL,
    is_primary  BOOLEAN NOT NULL DEFAULT false,
    active      BOOLEAN NOT NULL DEFAULT true,
    photo_url   VARCHAR(512),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID
);

CREATE INDEX ix_club_contact_club ON club_contact(club_id);

-- DB-level backstop for the service-layer auto-unset above — guarantees at most one active
-- primary per club even under a bug or race, without blocking a *deactivated* contact from
-- having stale is_primary=true sitting unused.
CREATE UNIQUE INDEX ux_club_contact_primary ON club_contact(club_id) WHERE is_primary AND active;
