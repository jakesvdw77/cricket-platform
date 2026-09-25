-- docs/specs/057-team-extended-profile.md: gives Team the same abbreviation/groundName/
-- socialLinks profile shape League already got in 053 (029-add-league-profile.sql), plus lets a
-- TeamSquadMember be flagged as that team/season's captain. Every column nullable/defaulted --
-- additive only, no backfill, safe against every existing team/team_squad_member row.

ALTER TABLE team ADD COLUMN abbreviation VARCHAR(16);
ALTER TABLE team ADD COLUMN ground_name VARCHAR(255);

CREATE TABLE team_social_link (
    team_id  UUID NOT NULL REFERENCES team(id),
    platform VARCHAR(64) NOT NULL,
    url      VARCHAR(512) NOT NULL,
    PRIMARY KEY (team_id, platform)
);

ALTER TABLE team_squad_member ADD COLUMN is_captain BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX ux_team_squad_captain ON team_squad_member(team_id, season_id) WHERE is_captain;
