-- docs/specs/104-match-results-import-adaptors.md: the guess flag on an imported player row and the per-club remembered
-- name mappings. Additive; existing rows get import_match NULL (nothing to confirm).

-- import_match is set only by an import, only on one of our players linked to a registered profile by a rule other than
-- an exact match or a remembered alias. NULL means nothing to confirm. AI_SUGGESTED is reserved and never produced yet.
ALTER TABLE result_player
    ADD COLUMN import_match VARCHAR(16),
    ADD CONSTRAINT ck_result_player_import_match_value CHECK (import_match IN ('NORMALISED', 'AI_SUGGESTED')),
    ADD CONSTRAINT ck_result_player_import_match_ours CHECK (
        import_match IS NULL OR (player_profile_id IS NOT NULL AND NOT opposition));

-- A name as a file spelt it, remembered per club so it is never asked twice. Opposition players have no aliases. An
-- alias is written by the server, a correction deactivates the previous row (it is never deleted).
CREATE TABLE result_name_alias (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id                  UUID NOT NULL REFERENCES club(id),
    kind                     VARCHAR(16) NOT NULL,
    alias_normalised         VARCHAR(255) NOT NULL,
    alias_original           VARCHAR(255) NOT NULL,
    target_player_profile_id UUID REFERENCES player_profile(id) ON DELETE CASCADE,
    target_team_id           UUID REFERENCES team(id) ON DELETE CASCADE,
    created_by               UUID,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    active                   BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT ck_result_name_alias_kind CHECK (kind IN ('PLAYER', 'TEAM')),
    CONSTRAINT ck_result_name_alias_target CHECK (
        (kind = 'PLAYER' AND target_player_profile_id IS NOT NULL AND target_team_id IS NULL)
        OR (kind = 'TEAM' AND target_team_id IS NOT NULL AND target_player_profile_id IS NULL))
);
CREATE UNIQUE INDEX ux_result_name_alias ON result_name_alias(club_id, kind, alias_normalised) WHERE active;
CREATE INDEX ix_result_name_alias_player ON result_name_alias(target_player_profile_id)
    WHERE target_player_profile_id IS NOT NULL;
CREATE INDEX ix_result_name_alias_team ON result_name_alias(target_team_id) WHERE target_team_id IS NOT NULL;
