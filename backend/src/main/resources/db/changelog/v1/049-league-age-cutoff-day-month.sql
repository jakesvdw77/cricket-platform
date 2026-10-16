-- docs/specs/110-league-age-cutoff-day-and-month.md: a league's age cut-off becomes a day and month (no year), judged in
-- the calendar year the league starts. The old dated column is dropped; there is no data to carry over.
ALTER TABLE league
    ADD COLUMN age_cutoff_month SMALLINT,
    ADD COLUMN age_cutoff_day   SMALLINT,
    ADD CONSTRAINT ck_league_age_cutoff_day_month CHECK (
        (age_cutoff_month IS NULL AND age_cutoff_day IS NULL)
        OR (age_cutoff_month IS NOT NULL AND age_cutoff_day IS NOT NULL
            AND age_cutoff_month BETWEEN 1 AND 12
            AND age_cutoff_day >= 1
            AND age_cutoff_day <= CASE
                WHEN age_cutoff_month = 2 THEN 29
                WHEN age_cutoff_month IN (4, 6, 9, 11) THEN 30
                ELSE 31 END));

ALTER TABLE league DROP COLUMN age_cutoff_date;
