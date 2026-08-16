---
description: Turn an approved spec into an implementation plan, constrained by the standards docs
argument-hint: <path to docs/specs/NNN-feature.md>
---

Enter plan mode for the spec at: $ARGUMENTS

1. Read the spec file fully, plus `CLAUDE.md` and every file in `docs/standards/`.
2. Read any spec it depends on (its "Depends on" line) — don't re-derive decisions those specs already made.
3. Produce an implementation plan: the file list to touch or create, in what order, and which of `backend-builder` / `frontend-builder` / `test-writer` handles each part.
4. The plan must not redefine anything the spec already fixed (entities, API shapes, scope rules) — flag it back to the human instead of quietly reinterpreting it.
5. Do not edit source files from this command — plan only.
6. Once the plan is approved via `ExitPlanMode`, copy it verbatim into `docs/plans/NNN-feature-name.md` (same number as the spec it implements) as a git-tracked permanent record — the working copy under `~/.claude/plans/` is a scratch file and isn't part of the repo's history.
