-- docs/specs/101-match-results-our-side-scorecard.md: the scorecard is entered before the Scores step, so a draft innings
-- may carry only some of its figures (or none, with just scorecard entries). NULL means "not entered". The range CHECKs
-- from 043 stay as they are: a CHECK passes for NULL. Publishing still requires the figures (ResultValidator).
ALTER TABLE match_innings
    ALTER COLUMN runs DROP NOT NULL,
    ALTER COLUMN wickets DROP NOT NULL,
    ALTER COLUMN balls DROP NOT NULL;
