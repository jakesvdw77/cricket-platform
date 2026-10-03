-- docs/specs/075-match-view-and-edit.md: optional external links for a match (a scoring page, a
-- live stream). Nullable, no default: every existing row keeps both as NULL.
ALTER TABLE match ADD COLUMN scoring_url   VARCHAR(1024);
ALTER TABLE match ADD COLUMN streaming_url VARCHAR(1024);
