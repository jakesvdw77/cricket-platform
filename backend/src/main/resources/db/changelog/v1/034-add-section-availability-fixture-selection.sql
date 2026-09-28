-- docs/specs/063-section-availability-and-flexible-squads.md: this revision's own migration (the
-- fixture-group selection revision) — replaces "pick a section and a date" with "pick a section
-- and tick which of its real upcoming fixtures a poll should cover". section_availability_round's
-- round_date and its unique constraint are dropped outright (verified against the real applied
-- schema first, not assumed: the auto-generated constraint name is
-- section_availability_round_section_id_round_date_key, confirmed via \d against local dev
-- Postgres), replaced by an admin-editable description plus computed first/last match dates and an
-- optional autoclose timestamp. No section_availability_round/window/response/match_squad_member
-- row has shipped anywhere outside local dev testing of this not-yet-released spec, so the new
-- columns are added NOT NULL directly rather than nullable + backfill + tighten — any local dev
-- rows left over from this spec's first two build passes were truncated before applying this
-- migration.

ALTER TABLE section_availability_round
    DROP CONSTRAINT IF EXISTS section_availability_round_section_id_round_date_key,
    DROP COLUMN round_date,
    ADD COLUMN description        VARCHAR(255) NOT NULL,
    ADD COLUMN first_match_date   DATE NOT NULL,
    ADD COLUMN last_match_date    DATE NOT NULL,
    ADD COLUMN auto_close         BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN scheduled_close_at TIMESTAMPTZ;

-- A window's matches are now an explicit, stored selection, not a live time-based scan (see Data
-- Model Changes, Part A). Unique on match_id — a given match belongs to at most one window, ever,
-- the DB-level backstop for "a match can't be polled twice."
CREATE TABLE section_availability_window_match (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    window_id  UUID NOT NULL REFERENCES section_availability_window(id),
    match_id   UUID NOT NULL REFERENCES match(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (match_id)
);

CREATE INDEX ix_section_availability_window_match_window ON section_availability_window_match(window_id);
