-- docs/specs/077-public-availability-form-verification.md, slice 2: the public availability form
-- verifies a player (name + date of birth) before an answer can be read or saved.
--
-- public_availability_attempt: one row per throttling key. 'name:...' keys count failed verifies per
-- (poll kind, poll id, canonical name) and lock the key; 'ip:...' keys count verify calls per client
-- address. Written with an atomic INSERT ... ON CONFLICT upsert so concurrent calls cannot undercount.
CREATE TABLE public_availability_attempt (
    scope_key         VARCHAR(255) PRIMARY KEY,
    failed_count      INTEGER      NOT NULL DEFAULT 0,
    window_started_at TIMESTAMPTZ  NOT NULL,
    locked_until      TIMESTAMPTZ
);

-- Who wrote the answer: MANAGER (a manager on the Responses page, and every answer that existed before
-- this migration) or PUBLIC_LINK (the player, through the verified public form).
ALTER TABLE player_availability ADD COLUMN source VARCHAR(16) NOT NULL DEFAULT 'MANAGER';
ALTER TABLE section_availability_response ADD COLUMN source VARCHAR(16) NOT NULL DEFAULT 'MANAGER';
