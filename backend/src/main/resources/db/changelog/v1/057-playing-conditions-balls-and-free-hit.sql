-- docs/specs/124: balls-per-over cap (null = no limit) and free hit after a no ball. Existing rows: no limit, free hit on.
ALTER TABLE league_playing_conditions ADD COLUMN max_balls_per_over INTEGER NULL;
ALTER TABLE league_playing_conditions ADD CONSTRAINT ck_lpc_max_balls_per_over CHECK (max_balls_per_over IS NULL OR (max_balls_per_over BETWEEN 1 AND 20));
ALTER TABLE league_playing_conditions ADD COLUMN free_hit_on_no_ball BOOLEAN NOT NULL DEFAULT TRUE;
