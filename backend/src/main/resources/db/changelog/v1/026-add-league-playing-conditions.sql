CREATE TABLE league_playing_conditions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id     UUID NOT NULL REFERENCES league(id),
    season_id     UUID NOT NULL REFERENCES season(id),
    document_url  VARCHAR(1024) NOT NULL,
    uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    uploaded_by   UUID,
    UNIQUE (league_id, season_id)
);

CREATE INDEX ix_league_playing_conditions_league ON league_playing_conditions(league_id);
CREATE INDEX ix_league_playing_conditions_season ON league_playing_conditions(season_id);
