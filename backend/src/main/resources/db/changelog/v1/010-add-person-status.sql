-- docs/specs/015-person-status-and-role-assignment.md: adds Person's lifecycle status. A single
-- metadata-only ADD COLUMN ... NOT NULL DEFAULT is safe in Postgres 11+ and backfills every
-- existing row to 'ACTIVE' as part of adding the column itself — no separate UPDATE needed.
ALTER TABLE person
    ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE';
