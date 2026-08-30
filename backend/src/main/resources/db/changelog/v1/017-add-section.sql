-- backend/src/main/resources/db/changelog/v1/017-add-section.sql
CREATE TABLE section (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id            UUID NOT NULL REFERENCES club(id),
    parent_section_id  UUID REFERENCES section(id),
    name               VARCHAR(255) NOT NULL,
    min_age            INTEGER,
    max_age            INTEGER,
    gender             VARCHAR(16),
    active             BOOLEAN NOT NULL DEFAULT true,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by         UUID
);

CREATE INDEX ix_section_club ON section(club_id);
CREATE INDEX ix_section_parent ON section(parent_section_id);

CREATE TABLE section_contact (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id       UUID NOT NULL REFERENCES section(id),
    club_contact_id  UUID NOT NULL REFERENCES club_contact(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by       UUID,
    UNIQUE (section_id, club_contact_id)
);

CREATE INDEX ix_section_contact_section ON section_contact(section_id);
CREATE INDEX ix_section_contact_contact ON section_contact(club_contact_id);
