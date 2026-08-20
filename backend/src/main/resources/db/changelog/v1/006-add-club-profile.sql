CREATE TABLE club_profile (
    club_id                UUID PRIMARY KEY REFERENCES club(id),
    type                   VARCHAR(16),
    logo_url               VARCHAR(512),
    banner_url             VARCHAR(512),
    address_number         VARCHAR(32),
    address_street         VARCHAR(255),
    address_city           VARCHAR(128),
    address_province_state VARCHAR(128),
    address_country        VARCHAR(128),
    address_postal_code    VARCHAR(32),
    email                  VARCHAR(255),
    phone                  VARCHAR(32),
    website                VARCHAR(512),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by             UUID
);
