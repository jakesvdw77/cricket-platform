-- docs/specs/076-team-selection.md: a selected player may have no batting position yet, and the
-- 12th man becomes an ordinary selection row (position NULL) instead of a bare id on match_side.
-- UNIQUE (match_side_id, batting_order) stays: Postgres treats NULLs as distinct, so many players
-- can wait without a position while two players can never share one.
ALTER TABLE match_side_player ALTER COLUMN batting_order DROP NOT NULL;

-- Backfill: every existing 12th man becomes a selection row with no position. role is NOT NULL, so
-- BATSMAN (the default the old Add player control used). Test data only; nothing is deployed.
INSERT INTO match_side_player (match_side_id, player_profile_id, batting_order, role)
SELECT ms.id, ms.twelfth_man_player_id, NULL, 'BATSMAN'
FROM match_side ms
WHERE ms.twelfth_man_player_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM match_side_player p
      WHERE p.match_side_id = ms.id AND p.player_profile_id = ms.twelfth_man_player_id);
