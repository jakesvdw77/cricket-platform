-- docs/specs/101-match-results-our-side-scorecard.md: a draft batting row may carry figures before the dismissal is
-- chosen (the scorer types the runs first). NULL how_out means "batted, how out not chosen yet". The allowed-values CHECK
-- from 044 stays as it is: a CHECK passes for NULL. Publishing refuses such a row (ResultValidator, HOW_OUT_MISSING).
ALTER TABLE batting_entry
    ALTER COLUMN how_out DROP NOT NULL;
