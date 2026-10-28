-- docs/specs/122-league-sharing.md: formats a club has switched off per shareable content type, stored as a JSON
-- object such as {"RESULT":["TV"],"LEAGUE":["FACEBOOK"]}. Additive; '{}' means every format stays offered.
ALTER TABLE club_profile ADD COLUMN share_disabled_formats TEXT NOT NULL DEFAULT '{}';
