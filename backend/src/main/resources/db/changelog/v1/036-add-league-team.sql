-- docs/specs/070-league-teams.md: a lightweight per-league, per-season opponent record ("league
-- team") a match can reference instead of a hand-typed opponent name. match keeps its name/logo
-- columns (denormalised copy), and gains a nullable league-team reference per side. The side CHECK
-- constraints are rewritten: a *_league_team_id is only allowed alongside a name. Every existing
-- row already satisfies the new checks, so no data change is needed.

CREATE TABLE league_team (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id     UUID NOT NULL REFERENCES league(id),
    season_id     UUID NOT NULL REFERENCES season(id),
    name          VARCHAR(255) NOT NULL,
    abbreviation  VARCHAR(16),
    logo_url      VARCHAR(1024),
    active        BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by    UUID
);

CREATE UNIQUE INDEX ux_league_team_name ON league_team(league_id, season_id, lower(name));
CREATE INDEX ix_league_team_league_season ON league_team(league_id, season_id);

ALTER TABLE match ADD COLUMN home_league_team_id UUID REFERENCES league_team(id);
ALTER TABLE match ADD COLUMN away_league_team_id UUID REFERENCES league_team(id);
CREATE INDEX ix_match_home_league_team ON match(home_league_team_id);
CREATE INDEX ix_match_away_league_team ON match(away_league_team_id);

ALTER TABLE match DROP CONSTRAINT ck_match_home_side;
ALTER TABLE match DROP CONSTRAINT ck_match_away_side;
ALTER TABLE match ADD CONSTRAINT ck_match_home_side CHECK (
    (home_team_id IS NOT NULL AND home_team_name IS NULL AND home_league_team_id IS NULL)
    OR (home_team_id IS NULL AND home_team_name IS NOT NULL));
ALTER TABLE match ADD CONSTRAINT ck_match_away_side CHECK (
    (away_team_id IS NOT NULL AND away_team_name IS NULL AND away_league_team_id IS NULL)
    OR (away_team_id IS NULL AND away_team_name IS NOT NULL));
