# 126: League page actions, and a schedule edit mode

**Status:** draft for the owner's approval (2026-10-30). Mockup approved in principle by the owner ("looks good", one-line fixes applied): `docs/mockups/league-page-actions-and-edit-mode-mockup.html`. Builds in two phases (see Rollout).
**Depends on:** `091-leagues-gold-standard.md` and `095-league-edit-gold-standard.md` (the league page and the league edit page), `122-league-sharing.md` (Share League dialog), `097`, `098` and `125` (import framework, schedule import, editable rows), `docs/standards/design-system.md` (record detail page, buttons, "Layout density"), `docs/standards/frontend.md`.

## Problem & Goals
The league page has drifted from the standard detail page: five buttons of mixed weight on the top row (Season pill, Share, Create match, Duplicate league, Edit), the Schedule tab's actions scattered across the content line (switches, Import schedule, a bare "Imports (n)" link), and a different arrangement again on the league edit page's Schedule tab. The owner wants one consistent place for each kind of action, and a schedule edit mode (change dates and teams, add and remove matches) that works like the import: edit in a table, see the checks, review, then save.

**Goals**
- A top row that holds only page-level actions, the same on every tab.
- Each tab's own actions on that tab's toolbar line, one filled button at most.
- A schedule **Edit mode** on the league page, reusing the import's row editor, checks and confirmation, so there is one way to change matches in bulk.
- Secondary buttons are white-filled across the app (owner rule 2026-10-30, applied in `theme.ts` and `design-system.md`).

## Non-goals
- Changing what Share, Duplicate league, Import or the Match form do.
- Editing league details, teams, conditions or contacts in place (they stay on the league edit page, "Edit league").
- Editing results, polls, selections or squads from this page.
- Showing matches of other leagues.

## User Stories
- As a club admin, I see the same few actions at the top of the league page on every tab, and the actions for the tab I am on right beside its content.
- As a club admin, I can press **Edit schedule**, change a match's date, time, teams or venue in the table, add and remove matches, see problems as I go, and save everything in one reviewed step.
- As a club admin, I am told when a match cannot be removed or have its time changed because it has a poll, selection, announced team or result.

## Page layout (view mode)
- **Top row:** Back on the left; on the right the Season pill, an **Actions** menu and the filled **Edit league** (the existing edit page). The Actions menu holds **Duplicate league**, **Share league...** (opens the Share League dialog) and **Import history (n)**. On a phone the Season pill and an Actions icon button share the row and Edit league is a full-width button under the title.
- **Amendment 2026-10-31:** the menus below were reworked: no corner pencil; Manage League is league-wide only; each tab has a white Manage Schedule, Manage Teams or Manage Playing Conditions menu with Share last. See `docs/standards/page-anatomy.md` section 8.
- **Header content:** title, format and Active badges, the contacts and links line, the key-figure strip, then the tabs (unchanged).
- **Schedule tab toolbar line:** the scope text ("Showing 6 matches . 2026/2027") on the left; on the right the **Only our matches** and **View entire season** switches, an outlined **Import schedule** and the filled **Edit schedule**. The header's **Create match** button is removed (see Edit mode, Add match, and the row chevron which still opens the full Match form).
- **Teams and Conditions tabs:** their actions sit on their own toolbar lines, right-aligned, one filled button at most (Teams: outlined **Copy teams**, filled **Add league team**; Conditions: outlined **Share**, filled **Edit conditions**). The top row never changes between tabs.
- **League edit page:** its Schedule tab no longer carries Share, Import and Add match; it shows a short panel pointing to **Edit schedule** on the league page (the same entry opens edit mode directly via `?edit=schedule`).

## Edit schedule mode
- **Entering:** **Edit schedule** switches the Schedule tab into edit mode (route `/manage/fixtures/leagues/:leagueId/schedule?seasonId=&edit=1`, so it survives a reload). The top row stays but Actions and Edit league are disabled, the other tabs are disabled, and the toolbar line becomes an **edit bar**: "Editing schedule", a chip "3 changes" with a breakdown (added, changed, removed), **Add match**, **Discard** and the filled **Review and save**.
- **The table** shows the season's matches of this league (the active ones; deactivated matches stay hidden as today) in the import's editable-row style: **Edit** per row opens the row editor of `125` (Date, Start time, Home team, Away team, Venue, optional Notes behind Add note; team lists limited to this league and the other side excluded; same live checks, including the possible-duplicates window, the own-team overlap, venue clash and league-dates rules, and **Extend league dates**). Changed cells show "was" values; an added row shows an **Added** chip; a removed row is struck through with **Undo**.
- **Review and save** opens the same Review as the import (what will be added, changed and removed, warnings to tick, League dates change if extended), then saves everything in one transaction. Nothing is written before the confirmation. **Discard** leaves with no change after a confirm if there are pending changes.
- **What can change, and the blockers:**
  - Adding a match: always allowed (the same validation as the import and the Match form).
  - Changing teams, date, time or venue of an existing match: allowed when the match has no poll, group-poll coverage, squad pool, selection, announced team or result; with such a dependant, a **time or date** change is blocked with the reason, a **venue-only** change is allowed with a warning (as `098`'s Update rules). Changing a team on a match with dependants is blocked.
  - Removing a match: only when it has no dependant (the blockers of deleting an import); otherwise **Remove** is disabled with the reason and Deactivate stays on the match page. Removal is a real delete through the existing guarded `MatchService.delete` (spec 109), listed on Review before confirmation.
- **Who:** club administrators only, as the import (`canAdministerClub`).

## Architecture (decision for the plan)
Edit mode must obey the standing rule that any bulk change ends in an explicit, server-enforced confirmation. It therefore reuses the import framework instead of adding a second write path: an edit session is a batch of type `LEAGUE_SCHEDULE` with source `EDIT`, **preloaded with the league and season's existing matches as rows** (each carrying `existingRef` = the match id and `origin EXISTING`), whose decisions hold edits, added rows and removals. The handler gains the outcomes the import did not have (**UPDATE** of date, teams, time and venue within the dependants rules above, and **DELETE**), planned changes and commit go through `MatchService.update`, `createBatch` and `delete`, and the token, digest, advisory lock, expiry and re-validation of `097` apply unchanged. An edit batch is recorded in the import history as "Schedule edit" and is **not** deletable as an import (its removals are real deletes). The plan must confirm this approach or propose a smaller one before Phase 2.

## API Contract
Phase 1 has none. Phase 2 is additive on the `097` endpoints: `POST /imports/LEAGUE_SCHEDULE/edit-session` (scope JSON: league, season) creates the preloaded batch (`400` if the league is inactive or has no season, the open-preview caps apply); `ImportRowDto` gains `origin EXISTING` and `existingRef`; `ImportDecisionsDto` gains `removedRows`; `ImportBatchDto.source` gains `EDIT`; planned-change actions gain `DELETE`. Exact shapes are fixed in the plan.

## Test Plan
Written after the owner's hand-check, per the standing rule. Phase 1: component tests for the top row and Actions menu (items, Share dialog opens, history opens, phone layout), the tab toolbars (one filled button, order), removal of Create match, the edit page pointer panel, and white-filled secondary buttons. Phase 2: backend unit and integration tests for the edit-session batch (preload, update rules and blockers, delete rules, all-or-nothing commit, token refused after an edit, re-validation, other club and section manager refused), handler tests for UPDATE and DELETE outcomes, UI tests for the edit bar, row states, Review and Discard, and an end-to-end golden path (skipped in CI until Keycloak).

## Acceptance Criteria
1. The league page top row holds only the Season pill, Actions and Edit league on every tab; no other page-level button appears there.
2. Schedule actions (Import schedule, Edit schedule) sit on the Schedule toolbar line; Teams and Conditions keep their own toolbar actions; no control sits alone in its own row on desktop.
3. Create match is gone from the top row; every route to the Match form that existed still works (row chevron, Add match in edit mode).
4. Secondary buttons render white-filled, on the page wash and on cards.
5. (Phase 2) Edit schedule changes, adds and removes matches through one reviewed, server-confirmed save; blocked changes explain why; nothing is written before the confirmation.

## Rollout Notes
- **Phase 1 (layout):** top row, Actions menu, tab toolbars, removal of the header Create match, the edit page pointer panel, `design-system.md` update (record detail page and buttons). UI only, no backend.
- **Phase 2 (Edit schedule mode):** the edit-session batch, handler UPDATE and DELETE outcomes, the edit bar, row states, Review and Discard. Largest part; planned separately after Phase 1 is hand-checked.
- `docs/roadmap.md`: add the leftovers when approved (stats tab toolbars, an Actions menu for other record pages).
