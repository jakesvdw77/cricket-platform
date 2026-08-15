---
description: Turn a feature idea into a spec file following the project's template
argument-hint: <short feature description>
---

Write a new feature spec for: $ARGUMENTS

1. Read `CLAUDE.md` and every file in `docs/standards/` first — the spec must be consistent with them, not repeat them.
2. Read `docs/specs/000-template.md` for the required section shape, and skim existing `docs/specs/NNN-*.md` files for cross-references and numbering (use the next sequential number).
3. Reference existing entities/endpoints from prior specs (especially `001-tenancy-identity-model.md`) rather than redefining them.
4. Write `docs/specs/NNN-feature-name.md` following the template exactly: Problem & Goals, Non-goals, User Stories, Data Model Changes, API Contract, UI Requirements, Test Plan, Acceptance Criteria, Rollout Notes.
5. Do not write or edit any source code. This command's only output is the spec file.
6. Stop and report the file path — a human reviews and edits the spec before `/plan-feature` runs against it.
