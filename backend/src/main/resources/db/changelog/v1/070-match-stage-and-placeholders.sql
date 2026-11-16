-- docs/specs/155-playoff-and-knockout-fixtures.md: a match's stage (null = a pool match), its label, and per-side TBC placeholders.
ALTER TABLE match ADD COLUMN stage            VARCHAR(60);
ALTER TABLE match ADD COLUMN stage_label      VARCHAR(80);
ALTER TABLE match ADD COLUMN home_placeholder BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE match ADD COLUMN away_placeholder BOOLEAN NOT NULL DEFAULT false;
