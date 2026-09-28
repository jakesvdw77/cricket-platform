-- docs/specs/063-section-availability-and-flexible-squads.md: this revision's own migration —
-- adds SectionAvailabilityRound, the actual public/admin-facing "one shared link per section per
-- day" surface, wrapping the SectionAvailabilityWindow bracket unit added by
-- 032-add-section-availability-and-flexible-squads.sql (unchanged, still the internal per-bracket
-- unit everything downstream reads/writes against).

CREATE TABLE section_availability_round (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id     UUID NOT NULL REFERENCES club(id),
    section_id  UUID NOT NULL REFERENCES section(id),
    round_date  DATE NOT NULL,
    open        BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID,
    UNIQUE (section_id, round_date)
);

CREATE INDEX ix_section_availability_round_club ON section_availability_round(club_id);
CREATE INDEX ix_section_availability_round_section ON section_availability_round(section_id);

-- No section_availability_window row has shipped anywhere outside local dev testing of this
-- not-yet-released spec, so round_id is added NOT NULL directly rather than nullable +
-- backfill + tighten, the sequence a table with real data would need. Any local dev rows
-- created by this spec's first build pass were cleared before applying this migration.
ALTER TABLE section_availability_window
    ADD COLUMN round_id UUID NOT NULL REFERENCES section_availability_round(id);

CREATE INDEX ix_section_availability_window_round ON section_availability_window(round_id);
