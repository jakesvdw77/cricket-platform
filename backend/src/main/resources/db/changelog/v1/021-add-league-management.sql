-- docs/specs/029-league-management.md
-- Amended per docs/plans/029-league-management.md's pre-build amendment: team_squad_member gains a
-- required season_id (unique triple, not just team_id/player_profile_id), and match.season_id is
-- NOT NULL (not nullable) — squad membership is season-scoped, not a standing roster.

CREATE TABLE league (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id               UUID NOT NULL REFERENCES club(id),
    name                  VARCHAR(255) NOT NULL,
    source                VARCHAR(16) NOT NULL DEFAULT 'INTERNAL',
    max_playing_xi_size   INTEGER NOT NULL DEFAULT 11,
    allow_substitutions   BOOLEAN NOT NULL DEFAULT false,
    min_age               INTEGER,
    max_age               INTEGER,
    age_cutoff_date       DATE,
    active                BOOLEAN NOT NULL DEFAULT true,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by            UUID
);

CREATE INDEX ix_league_club ON league(club_id);

CREATE TABLE season (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id     UUID NOT NULL REFERENCES club(id),
    label       VARCHAR(255) NOT NULL,
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID
);

CREATE INDEX ix_season_club ON season(club_id);

CREATE TABLE league_affiliation (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id   UUID NOT NULL REFERENCES league(id),
    team_id     UUID NOT NULL REFERENCES team(id),
    season_id   UUID NOT NULL REFERENCES season(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID,
    UNIQUE (league_id, team_id, season_id)
);

CREATE INDEX ix_league_affiliation_league ON league_affiliation(league_id);
CREATE INDEX ix_league_affiliation_team ON league_affiliation(team_id);
CREATE INDEX ix_league_affiliation_season ON league_affiliation(season_id);

CREATE TABLE team_squad_member (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id            UUID NOT NULL REFERENCES team(id),
    season_id          UUID NOT NULL REFERENCES season(id),
    player_profile_id  UUID NOT NULL REFERENCES player_profile(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by         UUID,
    UNIQUE (team_id, season_id, player_profile_id)
);

CREATE INDEX ix_team_squad_member_team ON team_squad_member(team_id);
CREATE INDEX ix_team_squad_member_season ON team_squad_member(season_id);
CREATE INDEX ix_team_squad_member_player ON team_squad_member(player_profile_id);

CREATE TABLE match (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id         UUID NOT NULL REFERENCES club(id),
    home_team_id    UUID REFERENCES team(id),
    home_team_name  VARCHAR(255),
    away_team_id    UUID REFERENCES team(id),
    away_team_name  VARCHAR(255),
    league_id       UUID REFERENCES league(id),
    season_id       UUID NOT NULL REFERENCES season(id),
    match_date      TIMESTAMPTZ NOT NULL,
    venue           VARCHAR(255),
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      UUID,
    CONSTRAINT ck_match_home_side CHECK ((home_team_id IS NOT NULL) <> (home_team_name IS NOT NULL)),
    CONSTRAINT ck_match_away_side CHECK ((away_team_id IS NOT NULL) <> (away_team_name IS NOT NULL))
);

CREATE INDEX ix_match_club ON match(club_id);
CREATE INDEX ix_match_home_team ON match(home_team_id);
CREATE INDEX ix_match_away_team ON match(away_team_id);
CREATE INDEX ix_match_league ON match(league_id);
CREATE INDEX ix_match_season ON match(season_id);
CREATE INDEX ix_match_date ON match(match_date);

CREATE TABLE match_side (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id                 UUID NOT NULL REFERENCES match(id),
    team_id                  UUID NOT NULL REFERENCES team(id),
    captain_player_id        UUID REFERENCES player_profile(id),
    wicket_keeper_player_id  UUID REFERENCES player_profile(id),
    twelfth_man_player_id    UUID REFERENCES player_profile(id),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by               UUID,
    UNIQUE (match_id, team_id)
);

CREATE INDEX ix_match_side_match ON match_side(match_id);
CREATE INDEX ix_match_side_team ON match_side(team_id);

CREATE TABLE match_side_player (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_side_id      UUID NOT NULL REFERENCES match_side(id),
    player_profile_id  UUID NOT NULL REFERENCES player_profile(id),
    batting_order      INTEGER NOT NULL,
    role               VARCHAR(16) NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (match_side_id, player_profile_id),
    UNIQUE (match_side_id, batting_order)
);

CREATE INDEX ix_match_side_player_side ON match_side_player(match_side_id);
CREATE INDEX ix_match_side_player_player ON match_side_player(player_profile_id);
