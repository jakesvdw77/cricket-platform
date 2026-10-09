-- docs/specs/088-players-polls-alignment.md: a player's verification status. Players created by a manager (and every
-- player that existed before this migration) are VERIFIED. A profile that a parent or player creates through a later
-- self-registration flow will arrive UNVERIFIED, and a manager verifies or rejects it. REJECTED players are hidden from
-- the default player list and counters but kept, so a mistaken reject can be undone. "Suspended" is not a value here: it
-- is the existing player_profile.active = false.
ALTER TABLE player_profile ADD COLUMN verification_status VARCHAR(16) NOT NULL DEFAULT 'VERIFIED';
ALTER TABLE player_profile ADD CONSTRAINT ck_player_profile_verification_status
    CHECK (verification_status IN ('VERIFIED', 'UNVERIFIED', 'REJECTED'));
