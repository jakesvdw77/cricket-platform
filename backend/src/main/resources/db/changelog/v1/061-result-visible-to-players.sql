-- docs/specs/145: Show In Player Hub. A published result shows in the Player Hub by default (every existing published result is switched on below, with its publisher and publish time); a manager can hide it, or opt out when publishing. A draft, an imported draft and an unpublished result are off. Unpublishing clears all three columns.
ALTER TABLE match_result ADD COLUMN visible_to_players BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE match_result ADD COLUMN visible_to_players_at TIMESTAMPTZ NULL;
ALTER TABLE match_result ADD COLUMN visible_to_players_by UUID NULL;
UPDATE match_result SET visible_to_players = TRUE, visible_to_players_at = published_at, visible_to_players_by = published_by WHERE status = 'PUBLISHED';
