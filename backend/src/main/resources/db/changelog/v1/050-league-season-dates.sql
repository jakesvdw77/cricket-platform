-- docs/specs/111-league-season-dates.md: the start and end date of a league in a season. Required when the row exists;
-- a league season with no row is simply not date-checked. No data to migrate.
CREATE TABLE league_season (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id   UUID NOT NULL REFERENCES league(id),
    season_id   UUID NOT NULL REFERENCES season(id),
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID,
    CONSTRAINT uq_league_season UNIQUE (league_id, season_id),
    CONSTRAINT ck_league_season_dates CHECK (start_date <= end_date)
);

CREATE INDEX ix_league_season_season ON league_season(season_id);
