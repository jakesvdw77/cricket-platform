-- docs/specs/151-server-test-round-one.md: where a player bats and whether they bowl a little.
ALTER TABLE player_profile ADD COLUMN batting_position   VARCHAR(16);
ALTER TABLE player_profile ADD COLUMN is_part_time_bowler BOOLEAN NOT NULL DEFAULT FALSE;
