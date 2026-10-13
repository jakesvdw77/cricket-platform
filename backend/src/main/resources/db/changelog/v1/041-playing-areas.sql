-- docs/specs/099-fields-directory.md: a platform-wide directory of playing areas (today only cricket fields), captured
-- by club managers, verified by a platform admin, linked to clubs as "home" and referenced by a match. A playing area is
-- deliberately not club-scoped: who captured it is created_by_club_id, who uses it is club_playing_area.
-- ground_id is reserved for step 2 (grounds/facilities): always null now, no foreign key until the ground table exists.
-- area_type only allows CRICKET_FIELD now; step 2 widens the CHECK for nets and other areas.

CREATE TABLE playing_area (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_type             VARCHAR(24) NOT NULL DEFAULT 'CRICKET_FIELD',
    name                  VARCHAR(200) NOT NULL,
    category              VARCHAR(16) NOT NULL,
    owner_type            VARCHAR(16) NOT NULL,
    owner_name            VARCHAR(200) NOT NULL,
    address_number        VARCHAR(255),
    address_street        VARCHAR(255),
    address_city          VARCHAR(255),
    address_province_state VARCHAR(255),
    address_country       VARCHAR(255),
    address_postal_code   VARCHAR(255),
    map_url               VARCHAR(500),
    location_notes        VARCHAR(500),
    verification_status   VARCHAR(16) NOT NULL DEFAULT 'UNVERIFIED',
    verified_at           TIMESTAMPTZ,
    verified_by_subject   VARCHAR(64),
    rejection_reason      VARCHAR(500),
    created_by_club_id    UUID REFERENCES club(id),
    ground_id             UUID,
    merged_into_id        UUID REFERENCES playing_area(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_playing_area_area_type CHECK (area_type IN ('CRICKET_FIELD')),
    CONSTRAINT ck_playing_area_category CHECK (category IN ('SCHOOL', 'CLUB', 'ACADEMY', 'PROVINCIAL')),
    CONSTRAINT ck_playing_area_owner_type CHECK (owner_type IN ('CLUB', 'SCHOOL', 'PROVINCE', 'OTHER')),
    CONSTRAINT ck_playing_area_verification_status CHECK (verification_status IN ('UNVERIFIED', 'VERIFIED', 'REJECTED'))
);

CREATE UNIQUE INDEX ux_playing_area_identity
    ON playing_area(area_type, lower(name), lower(address_city), address_country)
    WHERE merged_into_id IS NULL;
CREATE INDEX ix_playing_area_search ON playing_area(address_country, lower(address_city));
CREATE INDEX ix_playing_area_status ON playing_area(verification_status);

CREATE TABLE club_playing_area (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id          UUID NOT NULL REFERENCES club(id),
    playing_area_id  UUID NOT NULL REFERENCES playing_area(id),
    is_home          BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ux_club_playing_area UNIQUE (club_id, playing_area_id)
);

CREATE INDEX ix_club_playing_area_playing_area ON club_playing_area(playing_area_id);

ALTER TABLE match ADD COLUMN playing_area_id UUID REFERENCES playing_area(id);
CREATE INDEX ix_match_playing_area ON match(playing_area_id);
