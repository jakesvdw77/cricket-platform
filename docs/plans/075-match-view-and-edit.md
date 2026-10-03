# Plan 075 — Match View, Edit Match and Match Links

Implements `docs/specs/075-match-view-and-edit.md` (approved; design approved incl. the Pick match squad button). Design: https://claude.ai/artifact/Fz6x3LtTCGr61hGicEDtrj. Branch: `feature/075-match-view-and-edit` (off master; spec committed as `f58b38d`). Backend (small) first, then frontend.

## Context

The Match View is a stack of generic sections that doesn't look like the League view, shows an empty opponent card, and duplicates the poll's own Responses page in an Availability section; the Edit page repeats that as an Availability tab where poll links point; the card calls the same destination "Poll". This rebuilds the Match View on the League header (logos in the title, details and links under the divider, Select team / Availability / Share team sheet, one card per own team, a Pick match squad button for group-covered sides), removes the Availability tab (one header Availability button, tab order Details, Match Squad, Home XI, Away XI), repoints every link that targeted the tab, renames the card's Poll to Availability with a derby menu, and adds two optional match links (scoring, streaming).

## Findings that shape the plan

1. **Backend is two nullable columns** (migration `037`, entity, `CreateMatchRequest`/`UpdateMatchRequest`/`MatchDto` appended last, service validation helper, `openapi.yaml` additions), same shape as `070`'s match change. `MatchServiceImpl.enrichList` and ~31 test constructor calls need the two extra args.
2. **`getMatch` returns announced `false` and `polls` `[]`**, so the view page builds an overlay from `listMatchSides` (announced), `listPolls` and per-own-side `getMatchSquad` coverage via a new `matchPollsFrom` helper mirroring the backend's `069` rule; the poll badge and Availability button wait for those queries to settle.
3. **`pollDestination` is reshaped** (`{kind:'link'}` | `{kind:'menu'}`, `editTo` dropped) and a shared `useAvailabilityNavigation` hook (MUI `Menu`) serves the card, view page and edit page header; `RecordCardFooterButton.onClick` widens to receive the click event.
4. **The card's share wiring is extracted** into `useTeamSheetShare` and used by the card and the view page (same query keys, no duplication). Other extractions: `ownSides`, `matchLeagueValue`, `pickedLegend`, `announcedBadge`, `NO_CLUB_TEAM_REASON`.
5. **Edit page:** tabs keyed by string (`details`, `match-squad`, `home-xi`, `away-xi`) instead of indices; Availability tab and `MatchAvailabilityPanel` removed; `RecordFormScreen` gains an additive `headerAction`; `?tab=availability` falls back to Details; `components/MatchAvailabilityTab/` deleted after a grep for other importers.
6. **Links repointed:** `squadPollHref` -> Match View, `coveredPollHref` -> the covering poll's Responses page (GROUP existingPollId is the round id), callers `SquadPollResponsesPage`, `PollMatchesDialog`, `CoveredByNote` keep labels.
7. **Overlap:** draft `058` also edits `MatchFormPage`; whichever builds second rebases. Never touch the user's `CricketlegendApplication.java` / `055` / `058`.
8. Process constraints carry over: backend built/tested ONLY in an rsync'd scratch copy (never mvn in `backend/`), `source ~/.nvm/nvm.sh && nvm use 22.12.0`, one heavy command at a time with `uptime` checks, `configure({ asyncUtilTimeout })` for cold first renders instead of sleeps, explicit-path staging (never `git add docs` / `backend/src/main` wholesale).

## Part 1 — Backend (`backend-builder`, scratch-copy verification)

**B1.** `db/changelog/v1/037-add-match-scoring-streaming-urls.sql` + master changelog entry; `Match` gains `scoringUrl`/`streamingUrl`; `CreateMatchRequest`, `UpdateMatchRequest`, `MatchDto` gain the two fields appended last (MapStruct maps them; update `enrichList` and every positional constructor call incl. `MatchServiceImplTest`); one private validation helper in `MatchServiceImpl` for both fields in `create` and `update` (blank to null, trim, 1024 max, parseable `http`/`https` URL with a host, `ValidationException` messages per the spec); `openapi.yaml` additions only.
**Backend tests:** service (blank to null, trimmed storage, bad scheme/`javascript:`/no host/space/too long each 400 with field-named message, create/update round trip, `PUT` omitting clears), list and get return the fields, a migration test over existing data (new through-036 test-only changelog beside the existing pattern) leaving both null, controller integration round trip through real HTTP.

## Part 2 — Frontend (`frontend-builder`, in this order, one heavy command at a time)

**F1. Helpers and shared pieces:** `matchApi.ts` types (optional nullable fields); `matchCardHelpers.ts` additions (`ownSides`, `matchPollsFrom`, `matchLeagueValue`, `pickedLegend`, `announcedBadge`, `NO_CLUB_TEAM_REASON`, reshaped `pollDestination`); hooks `useAvailabilityNavigation.tsx` and `useTeamSheetShare.tsx`; `RecordCard` footer `onClick` event arg; `RecordFormScreen` `headerAction`; `validateMatchLink` and the two link `Input`s in `MatchForm` (+ tests/stories, existing tests green).
**F2. Match card:** rename Poll to Availability, shared hook + menu, links icon row (above the stretched link), use `useTeamSheetShare`, `matchLeagueValue`, `pickedLegend`; update card/list/SquadPicker tests.
**F3. Match View:** rewrite `MatchDetailPage` per spec section 1 (League-style header rows, logos with initials fallback and cricket-icon fallback, details and links, three actions with the shared disabled rule, overlay from sides/polls/squad queries, one card per own team with picked bar and read-only XI, group-covered Pick match squad button, derby two cards, neither-own note, phone stacking); remove the Details card and Availability section.
**F4. Edit page and links:** `MatchFormPage` string-keyed tabs in the new order, Availability tab/panel removed, header Availability button with the menu, `?tab=availability` falls back to Details, form passes the two links; delete `components/MatchAvailabilityTab/` (grep first); repoint `squadPollHref`/`coveredPollHref` and their callers; update their tests.
**Tests (Vitest/RTL):** the spec's full Component rows (view page, edit page, card, form, helpers incl. `pollDestination` and `matchPollsFrom`, link target updates). No arbitrary timeouts.

## Order and ownership

1. `backend-builder` (B1 + tests, scratch copy) and `frontend-builder` (F1-F4 + tests) in parallel (the frontend only mocks the two new fields until the backend lands). I verify independently: backend full `./mvnw test` in a fresh scratch rsync; frontend `tsc -p tsconfig.app.json --noEmit`, `npm run lint`, `npm run build`, vitest (`--project unit --testTimeout=30000`) on `pages/manage/matches`, `MatchDetailPage`, `MatchFormPage`, `MatchList`, `MatchForm`, `RecordCard`, `RecordFormScreen`, `pages/manage/availability`, `SquadPicker`.
2. `standards-reviewer` (read-only); fix findings. Docs by me in the same PR: `docs/roadmap.md` (slot-based Selection planner, links on public pages and team sheets, results/naming) and "Amended by 075" on the affected specs' Status lines.
3. Commits in chunks (`feat(backend)`, `test(backend)`, `feat(ui)`, `test(ui)`, `docs`) with explicit paths, PR, CI; I ask before merging. Browser check by you after a backend restart: the spec's browser row.

## Flags for your review

1. **Own team on the view/edit pages is decided from the team ids** (a cross-club team id counts as own there; the card keeps its list-count rule), as the spec states.
2. **Links without `https://` are rejected** (no silent prefixing), form and server.
3. **`MatchAvailabilityTab` is deleted**; `PollShareDialog` and `EditCloseTimeDialog` stay.
4. **Backend restart needed** for the new fields; the feature degrades gracefully without them.
5. Playwright not extended (no live services), as before.

## Verification

- Backend (scratch copy): full `./mvnw test` incl. ArchUnit; `openapi.yaml` additions only.
- Frontend: tsc, lint, build, touched-file vitest (full UI suite still has ~10-25 unrelated pre-existing 5s timeouts).
- Browser (after backend restart): Match View header, logos, details, links, three actions and the two-poll menu, one card for one own team and two for a derby, Pick match squad for a group-covered side, disabled actions with no own team; Edit page tabs order and header Availability button, old `?tab=availability` lands on Details; card label "Availability" and its links row; saving valid and invalid links.
