-- docs/specs/114-share-result.md: the club-wide default for "initials only" when a result is shared. Additive; every
-- existing club keeps showing full names (false) until a manager changes it.
ALTER TABLE club_profile ADD COLUMN share_initials_only BOOLEAN NOT NULL DEFAULT false;
