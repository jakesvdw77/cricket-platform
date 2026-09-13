-- docs/specs/031-jersey-numbers.md
-- Adds a player's standing jersey number (PlayerProfile) and a per-team-squad jersey number
-- (TeamSquadMember), unique per (team_id, season_id) where set. No CHECK constraint for
-- non-negativity — validated in the service layer only (see the spec's Data Model Changes).

ALTER TABLE player_profile
    ADD COLUMN jersey_number INTEGER;

ALTER TABLE team_squad_member
    ADD COLUMN jersey_number INTEGER;

CREATE UNIQUE INDEX ux_team_squad_member_jersey_number
    ON team_squad_member (team_id, season_id, jersey_number)
    WHERE jersey_number IS NOT NULL;
