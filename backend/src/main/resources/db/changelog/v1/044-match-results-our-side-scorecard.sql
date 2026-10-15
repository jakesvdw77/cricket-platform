-- docs/specs/101-match-results-our-side-scorecard.md: our side's scorecard for regular innings. Tenancy is
-- match_result.club_id (no club_id on the child rows). Enums are CHECK-constrained varchars, as in 043.
-- result_player is "who played for our side", once; batting / bowling / fielding rows and awards point at it, so a
-- swap or a link to a registered player is one update. A guest has player_profile_id NULL and a display_name.

-- Innings are reconciled in place on every save (resequenced when the toss changes), so the sequence uniqueness is
-- checked at commit, not per statement.
ALTER TABLE match_innings DROP CONSTRAINT ux_match_innings_sequence;
ALTER TABLE match_innings ADD CONSTRAINT ux_match_innings_sequence
    UNIQUE (match_result_id, sequence) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE match_innings
    ADD COLUMN wides              INT,
    ADD COLUMN no_balls           INT,
    ADD COLUMN byes               INT,
    ADD COLUMN leg_byes           INT,
    ADD COLUMN penalty_runs       INT,
    ADD COLUMN non_bowler_wickets INT,
    ADD CONSTRAINT ck_match_innings_extras_parts CHECK (
        (wides IS NULL OR wides >= 0) AND (no_balls IS NULL OR no_balls >= 0) AND (byes IS NULL OR byes >= 0)
        AND (leg_byes IS NULL OR leg_byes >= 0) AND (penalty_runs IS NULL OR penalty_runs >= 0)
        AND (non_bowler_wickets IS NULL OR non_bowler_wickets >= 0));

CREATE TABLE result_player (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_result_id            UUID NOT NULL REFERENCES match_result(id) ON DELETE CASCADE,
    side                       VARCHAR(8) NOT NULL,
    player_profile_id          UUID REFERENCES player_profile(id),
    display_name               VARCHAR(255),
    linked_by                  UUID,
    linked_at                  TIMESTAMPTZ,
    planned_batting_order      INT,
    replaced_player_profile_id UUID REFERENCES player_profile(id),
    substitute                 BOOLEAN NOT NULL DEFAULT false,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by                 UUID,
    CONSTRAINT ck_result_player_side CHECK (side IN ('HOME', 'AWAY')),
    CONSTRAINT ck_result_player_identity CHECK (player_profile_id IS NOT NULL OR display_name IS NOT NULL)
);
CREATE INDEX ix_result_player_result ON result_player(match_result_id);
CREATE INDEX ix_result_player_profile ON result_player(player_profile_id) WHERE player_profile_id IS NOT NULL;
-- A registered player once per side (both sides of a derby is allowed by the schema; PLAYER_ON_BOTH_SIDES warns).
CREATE UNIQUE INDEX ux_result_player_profile_side
    ON result_player(match_result_id, side, player_profile_id) WHERE player_profile_id IS NOT NULL;
-- Two unlinked guests on one side must be told apart; the same name may appear once on each side of a derby.
CREATE UNIQUE INDEX ux_result_player_guest_side
    ON result_player(match_result_id, side, lower(display_name)) WHERE player_profile_id IS NULL;

CREATE TABLE batting_entry (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_innings_id  UUID NOT NULL REFERENCES match_innings(id) ON DELETE CASCADE,
    result_player_id  UUID NOT NULL REFERENCES result_player(id) ON DELETE CASCADE,
    position          INT,
    how_out           VARCHAR(24) NOT NULL,
    runs              INT,
    balls             INT,
    fours             INT,
    sixes             INT,
    featured_override VARCHAR(8),
    featured          BOOLEAN,
    CONSTRAINT ux_batting_entry_player UNIQUE (match_innings_id, result_player_id),
    -- deferred so a whole-scorecard replace can reorder batters; NULLs (did not bat) never collide
    CONSTRAINT ux_batting_entry_position UNIQUE (match_innings_id, position) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT ck_batting_entry_how_out CHECK (how_out IN (
        'NOT_OUT', 'DID_NOT_BAT', 'BOWLED', 'CAUGHT', 'CAUGHT_AND_BOWLED', 'LBW', 'STUMPED', 'RUN_OUT', 'HIT_WICKET',
        'HANDLED_BALL', 'OBSTRUCTING_FIELD', 'HIT_BALL_TWICE', 'TIMED_OUT', 'RETIRED_NOT_OUT', 'RETIRED_OUT')),
    CONSTRAINT ck_batting_entry_position CHECK (position IS NULL OR position >= 1),
    CONSTRAINT ck_batting_entry_counts CHECK (
        (runs IS NULL OR runs >= 0) AND (balls IS NULL OR balls >= 0) AND (fours IS NULL OR fours >= 0)
        AND (sixes IS NULL OR sixes >= 0)),
    CONSTRAINT ck_batting_entry_override CHECK (featured_override IS NULL OR featured_override IN ('FEATURE', 'HIDE'))
);
CREATE INDEX ix_batting_entry_result_player ON batting_entry(result_player_id);

CREATE TABLE bowling_entry (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_innings_id  UUID NOT NULL REFERENCES match_innings(id) ON DELETE CASCADE,
    result_player_id  UUID NOT NULL REFERENCES result_player(id) ON DELETE CASCADE,
    bowling_order     INT,
    balls             INT NOT NULL DEFAULT 0,
    maidens           INT NOT NULL DEFAULT 0,
    runs              INT NOT NULL DEFAULT 0,
    wickets           INT NOT NULL DEFAULT 0,
    wides             INT,
    no_balls          INT,
    featured_override VARCHAR(8),
    featured          BOOLEAN,
    CONSTRAINT ux_bowling_entry_player UNIQUE (match_innings_id, result_player_id),
    CONSTRAINT ck_bowling_entry_counts CHECK (
        balls >= 0 AND maidens >= 0 AND runs >= 0 AND wickets >= 0 AND (wides IS NULL OR wides >= 0)
        AND (no_balls IS NULL OR no_balls >= 0) AND (bowling_order IS NULL OR bowling_order >= 1)),
    CONSTRAINT ck_bowling_entry_override CHECK (featured_override IS NULL OR featured_override IN ('FEATURE', 'HIDE'))
);
CREATE INDEX ix_bowling_entry_result_player ON bowling_entry(result_player_id);

CREATE TABLE fielding_entry (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_innings_id  UUID NOT NULL REFERENCES match_innings(id) ON DELETE CASCADE,
    result_player_id  UUID NOT NULL REFERENCES result_player(id) ON DELETE CASCADE,
    catches           INT NOT NULL DEFAULT 0,
    stumpings         INT NOT NULL DEFAULT 0,
    run_outs          INT NOT NULL DEFAULT 0,
    featured_override VARCHAR(8),
    featured          BOOLEAN,
    CONSTRAINT ux_fielding_entry_player UNIQUE (match_innings_id, result_player_id),
    CONSTRAINT ck_fielding_entry_counts CHECK (catches >= 0 AND stumpings >= 0 AND run_outs >= 0),
    CONSTRAINT ck_fielding_entry_override CHECK (featured_override IS NULL OR featured_override IN ('FEATURE', 'HIDE'))
);
CREATE INDEX ix_fielding_entry_result_player ON fielding_entry(result_player_id);

CREATE TABLE match_award (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_result_id  UUID NOT NULL REFERENCES match_result(id) ON DELETE CASCADE,
    award_type       VARCHAR(24) NOT NULL,
    side             VARCHAR(8) NOT NULL,
    result_player_id UUID REFERENCES result_player(id) ON DELETE CASCADE,
    display_name     VARCHAR(255),
    CONSTRAINT ck_match_award_type CHECK (award_type IN ('PLAYER_OF_MATCH', 'TEAM_PLAYER_OF_MATCH')),
    CONSTRAINT ck_match_award_side CHECK (side IN ('HOME', 'AWAY'))
);
CREATE INDEX ix_match_award_result ON match_award(match_result_id);
-- One official award per result; one team award per ours side (two in a derby).
CREATE UNIQUE INDEX ux_match_award_official ON match_award(match_result_id) WHERE award_type = 'PLAYER_OF_MATCH';
CREATE UNIQUE INDEX ux_match_award_team_side
    ON match_award(match_result_id, side) WHERE award_type = 'TEAM_PLAYER_OF_MATCH';
