CREATE TABLE sponsor (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id     UUID NOT NULL REFERENCES club(id),
    name        VARCHAR(255) NOT NULL,
    website     VARCHAR(512),
    email       VARCHAR(255),
    phone       VARCHAR(32),
    logo_url    VARCHAR(512),
    banner_url  VARCHAR(512),
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID
);

CREATE INDEX ix_sponsor_club ON sponsor(club_id);

CREATE TABLE sponsor_social_link (
    sponsor_id UUID NOT NULL REFERENCES sponsor(id),
    platform   VARCHAR(64) NOT NULL,
    url        VARCHAR(512) NOT NULL,
    PRIMARY KEY (sponsor_id, platform)
);
