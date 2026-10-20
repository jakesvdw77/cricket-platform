-- docs/specs/103-player-stats.md, decision 18: the award categories a club shows on the Leaderboards Awards view.
-- A JSON array of LeaderboardBoard codes; NULL means the nine defaults, so every existing club is unchanged.
ALTER TABLE club_profile ADD COLUMN leaderboard_award_categories JSONB;
