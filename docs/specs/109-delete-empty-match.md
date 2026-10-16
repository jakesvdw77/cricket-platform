# 109: Delete an Empty Match

**Depends on:** `089-match-page-form-and-list-view.md` (the Match page and its actions), `100-match-results-core.md` (the result), `104-match-results-import-adaptors.md` (the import's Match step, where a match can be added by mistake).
**Status:** approved by the user 2026-10-16 ("an empty match should be deletable, to avoid accidentally creating a match in the wrong section without having to disable it").

## Problem & Goals

A manager can create a match but cannot remove one. The only action is Deactivate, which hides a match and keeps it. The need showed up in the result import: the Match step offers "Match not listed? Add the match first", and a manager who adds a second copy of a match that was already listed ends up with two identical-looking entries, one of which is useless and cannot be removed. (A real example: the duplicate had no club team, no result, no poll, no squad and no selection.)

Goal: let a club manager **delete a match that has nothing recorded against it**, from the Match page and from the import's Match step, and refuse (clearly) when anything is attached, so no real data is ever lost.

## Non-goals

- **Deleting a match that has any data.** A result (draft or published), an availability poll, a squad or selection, a match side, or an availability window link makes the match not deletable. The manager can still Deactivate it. Cascading deletes are deliberately not offered.
- **Bulk delete.**
- **Restoring a deleted match.** A delete is final; it only applies to a match with nothing in it.
- **Stopping the duplicate from being created.** A separate, optional improvement (see Rollout Notes).
- **Deleting a match from a league fixture import** (`098`): out of scope.

## User Stories

- As a club manager, I can delete a match I created by mistake, so that it does not clutter my lists and my import's match choices.
- As a club manager, I only see Delete on a match that is empty, and I am asked to confirm, so that I cannot lose anything by accident.
- As a club manager, if a match has data I see why it cannot be deleted and that Deactivate is the alternative, so that I know what to do.
- As a club manager, I can delete the duplicate straight from the import's Match step, so that I do not have to leave the import.

## Data Model Changes

**None.** No migration. A delete removes one `match` row, and only when no row in `match_result`, `match_availability_poll`, `match_squad_member`, `match_side` or `section_availability_window_match` refers to it (the database's foreign keys would refuse it anyway; the service checks first to give a clear message).

## API Contract

Additive only.

| Endpoint | Access | Purpose |
|---|---|---|
| `DELETE /api/v1/manage/clubs/{clubId}/matches/{matchId}` | club manager who can administer the match (the same rule as edit and deactivate) | Deletes an empty match. `204` on success. `404` if it is not this club's. `409` (`MatchNotEmptyException`, a `ConflictException`) when anything is attached, with a message naming what, for example "This match has a draft result. Deactivate it instead." |

`MatchDto` gains `deletable: boolean` (true when nothing is attached) so the screens can show or hide Delete without a second call. `MatchCandidateDto` (the import's candidate list) gains the same `deletable: boolean`. `openapi.yaml` gains the new route, the two fields and the 409 response.

## UI Requirements

- **Match page:** a Delete button beside Deactivate, shown only when `deletable` is true (outlined, error colour, 44 px, the same pattern as "Delete draft" on the result page). It opens the existing `ConfirmDialog`: "Delete this match? It has nothing recorded against it. This cannot be undone." Confirm deletes and returns to the matches list with a short success message. A `409` shows its message in the dialog.
- **Import Match step:** each candidate that is `deletable` shows a small "Delete" text button on its row (44 px target, not part of the choice tile so it never changes the selection), opening the same confirm dialog. On success the list refreshes; if the deleted match was the selected one the selection is cleared.
- **Wording:** the screens say "Delete" and "match", never internal names.
- **Reuse:** `ConfirmDialog`, the existing delete-draft pattern, and the existing mutation and query invalidation conventions; no new component.

## Test Plan

- **Backend unit and integration:** an empty match is deleted (204, the row is gone); a match with each of a draft result, a published result, a poll, a squad member, a match side and an availability window link is refused with the matching 409 message and nothing is removed; another club's match is 404; a user who cannot administer the match is 403; `deletable` is true only for an empty match in `MatchDto` and in the import candidates; the OpenAPI additions.
- **Frontend:** the Match page shows Delete only when `deletable`, confirms before calling, goes back to the list on success and shows a 409 message; the import Match step shows the row Delete only for deletable candidates, does not change the selection when pressed, refreshes the list and clears a deleted selection.
- **Manual:** delete the duplicate match from the Match step; try to delete the match that holds a draft and see the refusal.

## Acceptance Criteria

- [ ] An empty match can be deleted from the Match page and from the import's Match step, after a confirmation.
- [ ] A match with any result, poll, squad, selection or availability link cannot be deleted, shows a clear message and keeps all its data.
- [ ] The Delete button appears only on a deletable match.
- [ ] Only a manager who can administer the match can delete it; another club's match cannot.
- [ ] OpenAPI changes are additive; no new library.

## Rollout Notes

- **Optional follow-up:** in the import's Match step, when a candidate already matches by external id, make "Add the match first" less prominent, or warn "A match like this is already listed above", so the duplicate is not created in the first place. Not part of this spec unless the user asks.
- **Order of work:** the service and endpoint with `deletable`, then the OpenAPI, then the Match page button, then the import row, then tests, docs and the PR.
- **Docs to update when built:** `docs/roadmap.md`, `docs/standards/backend.md` (a delete is allowed only on an empty record), a pointer in `089`'s Rollout Notes.
