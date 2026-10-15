-- docs/specs/101-match-results-our-side-scorecard.md (merged full-scorecard spec): the opposition's scorecard, the
-- dismissing bowler and fielder on a batting entry, derived-or-manual bowling and fielding credits, dot balls, and an
-- award that keeps its name when the player's row is removed. Additive; existing rows migrate as MANUAL / not opposition.

-- An opposition player is a name, a side and an optional substitute marker, nothing else: never a profile, never linked.
ALTER TABLE result_player
    ADD COLUMN opposition BOOLEAN NOT NULL DEFAULT false,
    ADD CONSTRAINT ck_result_player_opposition CHECK (
        NOT opposition OR (player_profile_id IS NULL AND display_name IS NOT NULL
                           AND planned_batting_order IS NULL AND replaced_player_profile_id IS NULL
                           AND linked_by IS NULL));

-- The bowler and the fielder credited with a dismissal are players of the fielding side's list. Removing that player
-- leaves the dismissal in place without the reference.
ALTER TABLE batting_entry
    ADD COLUMN bowler_result_player_id  UUID REFERENCES result_player(id) ON DELETE SET NULL,
    ADD COLUMN fielder_result_player_id UUID REFERENCES result_player(id) ON DELETE SET NULL;
CREATE INDEX ix_batting_entry_bowler ON batting_entry(bowler_result_player_id) WHERE bowler_result_player_id IS NOT NULL;
CREATE INDEX ix_batting_entry_fielder ON batting_entry(fielder_result_player_id) WHERE fielder_result_player_id IS NOT NULL;

-- A DERIVED row's stored values are recomputed from the dismissals on every save; a MANUAL row's never are.
ALTER TABLE bowling_entry
    ADD COLUMN wickets_source VARCHAR(8) NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN dots           INT,
    ADD CONSTRAINT ck_bowling_entry_wickets_source CHECK (wickets_source IN ('MANUAL', 'DERIVED')),
    ADD CONSTRAINT ck_bowling_entry_dots CHECK (dots IS NULL OR (dots >= 0 AND dots <= balls));

ALTER TABLE fielding_entry
    ADD COLUMN credits_source VARCHAR(8) NOT NULL DEFAULT 'MANUAL',
    ADD CONSTRAINT ck_fielding_entry_credits_source CHECK (credits_source IN ('MANUAL', 'DERIVED'));

-- The award keeps the player's name (display_name is refreshed on every save), so removing an opposition row leaves
-- the award standing with its name instead of deleting it.
ALTER TABLE match_award DROP CONSTRAINT match_award_result_player_id_fkey;
ALTER TABLE match_award ADD CONSTRAINT match_award_result_player_id_fkey
    FOREIGN KEY (result_player_id) REFERENCES result_player(id) ON DELETE SET NULL;
