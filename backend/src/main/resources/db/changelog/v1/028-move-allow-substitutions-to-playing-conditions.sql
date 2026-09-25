-- docs/specs/052-league-playing-conditions.md amendment: allowSubstitutions was never enforced by
-- any backend rule (purely informational display text on League) and, like the rest of
-- league_playing_conditions' structured fields, plausibly differs by season -- unlike League's own
-- long-lived, reused-across-many-affiliations row. Moved to the per-(league,season) record.
ALTER TABLE league_playing_conditions ADD COLUMN allow_substitutions BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE league DROP COLUMN allow_substitutions;
