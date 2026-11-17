-- docs/specs/158-main-sponsor.md: one linked sponsor of a team can be its main sponsor, listed (and put on posters) first.
ALTER TABLE team_sponsor ADD COLUMN is_main BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX ux_team_sponsor_main ON team_sponsor (team_id) WHERE is_main;
