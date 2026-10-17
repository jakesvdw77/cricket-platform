# Plan: 109: Delete an Empty Match

Spec: `docs/specs/109-delete-empty-match.md` (approved 2026-10-16).

## Slices

1. **Backend.** `MatchService.delete(authentication, clubId, matchId)` (interface and impl): the same access rule as edit and deactivate (`requireAdministrableMatch`), 404 for another club's match, and a refusal when anything is attached: a result of any status, an availability poll, a squad member, a match side, or an availability-window link. New `MatchNotEmptyException extends ConflictException` whose message names what exists. `DELETE /api/v1/manage/clubs/{clubId}/matches/{matchId}` returns 204. `MatchDto` and `MatchCandidateDto` gain `deletable: boolean`, computed with batched exists-queries (no query per row in a list). `openapi.yaml` additions only (route, two fields, 409).
2. **Frontend.** `matchApi.deleteMatch`; the Match page shows an outlined error-colour Delete beside Deactivate only when `deletable`, with the existing `ConfirmDialog`; the import's Match step shows a small Delete on each deletable candidate row (not part of the choice tile) with the same confirm, refreshes the list and clears a deleted selection. Match list types updated.
3. **Tests.** Backend unit and Testcontainers integration (each attachment refuses with 409 and nothing is removed; empty deletes; other club 404; no permission 403; `deletable` true only when empty, in the DTO and in import candidates); frontend tests for both places; ArchUnit and contract.
4. **Docs.** Roadmap row, `docs/standards/backend.md` (a delete only on an empty record), a pointer in spec 089's Rollout Notes.

## Rules

No new library, no migration. UK spelling, no em dashes. Run backend tests only in a scratch copy (a live backend runs from the main checkout's `backend/`). This work happens in the git worktree at /private/tmp/claude-501/-Users-jaco-Development-cricket-platform-v2/c7cb858d-7865-424f-a91e-8980c6831dc4/scratchpad/wt109 on branch `feature/109-delete-empty-match`, not in the main checkout.
