---
description: Adversarial standards-compliance pass over the current diff before opening a PR
---

Review the current diff against `docs/standards/backend.md`, `docs/standards/frontend.md`, `docs/standards/design-system.md`, and `docs/standards/testing.md`.

1. Check every changed file against the standard for its layer (controller/service/repository shape, component anatomy, mobile-first, reuse-before-write, required test tier for the change type).
2. Flag any duplicated logic/markup this diff introduces that should have extended an existing component/service instead (Principle 2 in `CLAUDE.md`).
3. Confirm the PR's spec link, applicable standards sections, and test tiers are identifiable from the diff — if it's unclear which spec this implements, say so.
4. Report findings as a list: file, standard violated, and the specific fix — not general commentary.
