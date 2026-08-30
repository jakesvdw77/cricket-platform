-- backend/src/main/resources/db/changelog/v1/019-add-team-profile.sql
ALTER TABLE team ADD COLUMN logo_url VARCHAR(512);

CREATE TABLE team_contact (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id          UUID NOT NULL REFERENCES team(id),
    club_contact_id  UUID NOT NULL REFERENCES club_contact(id),
    role             VARCHAR(128) NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by       UUID,
    UNIQUE (team_id, club_contact_id)
);

CREATE INDEX ix_team_contact_team ON team_contact(team_id);
CREATE INDEX ix_team_contact_contact ON team_contact(club_contact_id);

CREATE TABLE team_sponsor (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID NOT NULL REFERENCES team(id),
    sponsor_id  UUID NOT NULL REFERENCES sponsor(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID,
    UNIQUE (team_id, sponsor_id)
);

CREATE INDEX ix_team_sponsor_team ON team_sponsor(team_id);
CREATE INDEX ix_team_sponsor_sponsor ON team_sponsor(sponsor_id);
