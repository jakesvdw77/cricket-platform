-- docs/specs/063-section-availability-and-flexible-squads.md: Team.squadMode (STATIC default,
-- FLEXIBLE opt-in), the section-scoped availability ask (SectionAvailabilityWindow/
-- SectionAvailabilityResponse, mirroring 032's MatchAvailabilityPoll/PlayerAvailability shape),
-- and the per-fixture squad pool for a FLEXIBLE team (MatchSquadMember), including the Part C
-- hard-block unique constraint on (section_availability_window_id, player_profile_id).

ALTER TABLE team
    ADD COLUMN squad_mode VARCHAR(16) NOT NULL DEFAULT 'STATIC';

CREATE TABLE section_availability_window (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id     UUID NOT NULL REFERENCES club(id),
    section_id  UUID NOT NULL REFERENCES section(id),
    window_date DATE NOT NULL,
    day_part    VARCHAR(16) NOT NULL,
    open        BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID,
    UNIQUE (section_id, window_date, day_part)
);

CREATE INDEX ix_section_availability_window_club ON section_availability_window(club_id);
CREATE INDEX ix_section_availability_window_section ON section_availability_window(section_id);

CREATE TABLE section_availability_response (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    window_id          UUID NOT NULL REFERENCES section_availability_window(id),
    player_profile_id  UUID NOT NULL REFERENCES player_profile(id),
    status             VARCHAR(16) NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by         UUID,
    UNIQUE (window_id, player_profile_id)
);

CREATE INDEX ix_section_availability_response_window ON section_availability_response(window_id);
CREATE INDEX ix_section_availability_response_player ON section_availability_response(player_profile_id);

CREATE TABLE match_squad_member (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id                        UUID NOT NULL REFERENCES match(id),
    team_id                         UUID NOT NULL REFERENCES team(id),
    section_availability_window_id UUID NOT NULL REFERENCES section_availability_window(id),
    player_profile_id               UUID NOT NULL REFERENCES player_profile(id),
    jersey_number                   INTEGER,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by                      UUID,
    UNIQUE (match_id, team_id, player_profile_id),
    UNIQUE (section_availability_window_id, player_profile_id)
);

CREATE INDEX ix_match_squad_member_match ON match_squad_member(match_id);
CREATE INDEX ix_match_squad_member_team ON match_squad_member(team_id);
CREATE INDEX ix_match_squad_member_window ON match_squad_member(section_availability_window_id);
CREATE INDEX ix_match_squad_member_player ON match_squad_member(player_profile_id);

CREATE UNIQUE INDEX ux_match_squad_member_jersey_number
    ON match_squad_member (match_id, team_id, jersey_number)
    WHERE jersey_number IS NOT NULL;
