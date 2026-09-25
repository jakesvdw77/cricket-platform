ALTER TABLE league_playing_conditions ALTER COLUMN document_url DROP NOT NULL;
ALTER TABLE league_playing_conditions ALTER COLUMN uploaded_at DROP NOT NULL;
ALTER TABLE league_playing_conditions ALTER COLUMN uploaded_at DROP DEFAULT;

ALTER TABLE league_playing_conditions ADD COLUMN max_overs_per_innings INTEGER;
ALTER TABLE league_playing_conditions ADD COLUMN powerplay_overs INTEGER;
ALTER TABLE league_playing_conditions ADD COLUMN max_overs_per_bowler INTEGER;
ALTER TABLE league_playing_conditions ADD COLUMN fielding_restrictions_notes TEXT;

ALTER TABLE league_playing_conditions ADD COLUMN points_for_win INTEGER;
ALTER TABLE league_playing_conditions ADD COLUMN points_for_loss INTEGER;
ALTER TABLE league_playing_conditions ADD COLUMN points_for_draw INTEGER;
ALTER TABLE league_playing_conditions ADD COLUMN points_for_no_result INTEGER;
ALTER TABLE league_playing_conditions ADD COLUMN points_for_forfeit_win INTEGER;

ALTER TABLE league_playing_conditions ADD COLUMN bonus_points_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE league_playing_conditions ADD COLUMN bonus_batting_overs_threshold INTEGER;
ALTER TABLE league_playing_conditions ADD COLUMN bonus_bowling_restriction_percentage INTEGER;

ALTER TABLE league_playing_conditions ADD COLUMN additional_notes TEXT;
