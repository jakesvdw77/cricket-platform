-- docs/specs/145: a published result shows in the Player Hub by default. Migration 061 added the columns (off for every row); this switches on every
-- result that is already published, with its publisher and publish time. A draft, an imported draft and an unpublished result stay off.
UPDATE match_result SET visible_to_players = TRUE, visible_to_players_at = published_at, visible_to_players_by = published_by WHERE status = 'PUBLISHED';
