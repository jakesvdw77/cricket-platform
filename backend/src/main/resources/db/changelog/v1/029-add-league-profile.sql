-- docs/specs/053-league-extended-profile.md: gives League the same club-facing profile shape
-- ClubProfile/Sponsor already have. Column sizes/types copied verbatim from sponsor/
-- sponsor_social_link (015-add-sponsor.sql) rather than re-derived. Every column nullable/
-- additive only -- no backfill, safe against every existing league row.

ALTER TABLE league ADD COLUMN logo_url VARCHAR(512);
ALTER TABLE league ADD COLUMN format VARCHAR(16);
ALTER TABLE league ADD COLUMN phone VARCHAR(32);
ALTER TABLE league ADD COLUMN website VARCHAR(512);
ALTER TABLE league ADD COLUMN email VARCHAR(255);

CREATE TABLE league_social_link (
    league_id UUID NOT NULL REFERENCES league(id),
    platform  VARCHAR(64) NOT NULL,
    url       VARCHAR(512) NOT NULL,
    PRIMARY KEY (league_id, platform)
);
