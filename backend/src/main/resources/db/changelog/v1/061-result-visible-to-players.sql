-- docs/specs/145: Show In Player Hub. A published result reaches the Player Hub only when a manager switches it on; off for every result, with no backfill. Unpublishing clears all three columns.
ALTER TABLE match_result ADD COLUMN visible_to_players BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE match_result ADD COLUMN visible_to_players_at TIMESTAMPTZ NULL;
ALTER TABLE match_result ADD COLUMN visible_to_players_by UUID NULL;
