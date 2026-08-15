---
name: new-migration
description: Scaffolds the next sequential Liquibase migration file and its changelog entry. Use when a schema change is needed alongside an entity change.
---

1. Find the highest existing number under `backend/src/main/resources/db/changelog/v1/NNN-*.sql` (starts empty — first migration is `001-`).
2. Create `backend/src/main/resources/db/changelog/v1/NNN-description.sql` with the DDL for this change.
3. Add an `<include file="db/changelog/v1/NNN-description.sql"/>` entry to `backend/src/main/resources/db/changelog/db.changelog-master.xml`, after the existing includes.
4. The entity/repository change this migration supports goes in the *same* PR — never split a migration from the code that needs it (`docs/standards/backend.md`).
5. `ddl-auto` stays `validate` — this migration is the only way the schema changes, never Hibernate auto-DDL.
