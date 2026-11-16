-- docs/specs/154-team-affiliation-and-league-host.md: a team's affiliation (name, logo) and a league's tournament host and its affiliation (name, logo each), for the Poster team sheet.
ALTER TABLE team   ADD COLUMN affiliation_name     VARCHAR(120);
ALTER TABLE team   ADD COLUMN affiliation_logo_url VARCHAR(512);
ALTER TABLE league ADD COLUMN host_name            VARCHAR(120);
ALTER TABLE league ADD COLUMN host_logo_url        VARCHAR(512);
ALTER TABLE league ADD COLUMN affiliation_name     VARCHAR(120);
ALTER TABLE league ADD COLUMN affiliation_logo_url VARCHAR(512);
