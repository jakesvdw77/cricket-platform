-- docs/specs/064-unified-availability-polls.md: polling style is now chosen per poll, not per team,
-- so team.squad_mode (added by 032-add-section-availability-and-flexible-squads.sql) is dropped.
-- Squad (per-match) polls also gain the same autoclose columns section_availability_round got in
-- 034, so the new scheduled job can close both kinds. Nothing is deployed, so no backfill: existing
-- local-dev poll rows take auto_close = true with a NULL scheduled_close_at, i.e. they never
-- auto-close until recreated.

ALTER TABLE team
    DROP COLUMN squad_mode;

ALTER TABLE match_availability_poll
    ADD COLUMN auto_close         BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN scheduled_close_at TIMESTAMPTZ;
