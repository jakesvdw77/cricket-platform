-- docs/specs/032-match-availability-polls.md
-- Adds MatchAvailabilityPoll (one per match+team) and PlayerAvailability (one per poll+player),
-- player-identity-agnostic (player_profile_id-keyed, not session-derived) so a future login-aware
-- consumer can read/write the exact same rows with zero schema rework (see the spec's Rollout
-- Notes).

CREATE TABLE match_availability_poll (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id    UUID NOT NULL REFERENCES match(id),
    team_id     UUID NOT NULL REFERENCES team(id),
    open        BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID,
    UNIQUE (match_id, team_id)
);

CREATE INDEX ix_match_availability_poll_match ON match_availability_poll(match_id);
CREATE INDEX ix_match_availability_poll_team ON match_availability_poll(team_id);

CREATE TABLE player_availability (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id            UUID NOT NULL REFERENCES match_availability_poll(id),
    player_profile_id  UUID NOT NULL REFERENCES player_profile(id),
    status             VARCHAR(16) NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by         UUID,
    UNIQUE (poll_id, player_profile_id)
);

CREATE INDEX ix_player_availability_poll ON player_availability(poll_id);
CREATE INDEX ix_player_availability_player ON player_availability(player_profile_id);
