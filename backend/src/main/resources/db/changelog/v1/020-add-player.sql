-- docs/specs/028-players.md
ALTER TABLE person
    ALTER COLUMN email DROP NOT NULL,
    ADD COLUMN date_of_birth DATE,
    ADD COLUMN gender VARCHAR(16);

CREATE TABLE club_membership (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id  UUID NOT NULL REFERENCES person(id),
    club_id    UUID NOT NULL REFERENCES club(id),
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to   DATE
);

CREATE INDEX ix_club_membership_person ON club_membership(person_id);
CREATE INDEX ix_club_membership_club ON club_membership(club_id);
CREATE UNIQUE INDEX ux_club_membership_active ON club_membership(person_id) WHERE valid_to IS NULL;

CREATE TABLE player_profile (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id                UUID NOT NULL REFERENCES person(id),
    club_id                  UUID NOT NULL REFERENCES club(id),
    photo_url                VARCHAR(512),
    club_membership_number   VARCHAR(64),
    medical_aid_provider     VARCHAR(255),
    medical_aid_member_number VARCHAR(64),
    phone                    VARCHAR(32),
    email                    VARCHAR(255),
    alt_contact_name         VARCHAR(255),
    alt_contact_phone        VARCHAR(32),
    batting_stance           VARCHAR(16),
    bowling_arm              VARCHAR(16),
    bowling_type             VARCHAR(32),
    is_wicket_keeper         BOOLEAN NOT NULL DEFAULT false,
    active                   BOOLEAN NOT NULL DEFAULT true,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by               UUID,
    UNIQUE (person_id, club_id)
);

CREATE INDEX ix_player_profile_club ON player_profile(club_id);
CREATE INDEX ix_player_profile_person ON player_profile(person_id);

CREATE TABLE player_section (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_profile_id UUID NOT NULL REFERENCES player_profile(id),
    section_id        UUID NOT NULL REFERENCES section(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by        UUID,
    UNIQUE (player_profile_id, section_id)
);

CREATE INDEX ix_player_section_player ON player_section(player_profile_id);
CREATE INDEX ix_player_section_section ON player_section(section_id);
