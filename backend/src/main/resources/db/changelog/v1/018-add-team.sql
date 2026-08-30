-- backend/src/main/resources/db/changelog/v1/018-add-team.sql
CREATE TABLE team (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id     UUID NOT NULL REFERENCES club(id),
    section_id  UUID NOT NULL REFERENCES section(id),
    name        VARCHAR(255) NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID
);

CREATE INDEX ix_team_club ON team(club_id);
CREATE INDEX ix_team_section ON team(section_id);
