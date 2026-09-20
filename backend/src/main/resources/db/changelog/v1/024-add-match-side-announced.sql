-- docs/specs/040-announce-team.md
ALTER TABLE match_side
    ADD COLUMN announced BOOLEAN NOT NULL DEFAULT false;
