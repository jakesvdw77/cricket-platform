# Plan 074 — Availability Coverage

Implements `docs/specs/074-availability-coverage.md` (approved; design approved; Covered rule per the user's "A": strict, no team relies on a shared player). Design: https://claude.ai/artifact/4x7HDVQG893xvcv8rSQJar (the mockup's Covered example numbers are superseded by the spec's). Branch: `feature/074-availability-coverage` (off master; spec already on master, `073` merged as `072ce88`). Frontend only: no backend, migration or `openapi.yaml` change.

## Context

A manager running two or three sides in one slot cannot tell whether they have enough **distinct** players: 15 available for one team and 14 for another can be many of the same people. Coverage is the third tab of the `073` Availability hub: one card per time slot (local date + Morning/Afternoon) saying how many distinct players are available for how many places, per-team bars (own-only vs shared vs the XI tick), who is double-booked, and a verdict (Covered / Tight / Short by N / No XI size / No poll yet) decided by bipartite matching. It is computed in the browser from the existing Players grid response plus `listLeagues` (for `maxPlayingXiSize`).

## Findings that shape the plan

1. **Correctness lives in one pure util** (`slotCoverage.ts`, no React): slotting, per-team available/unsure sets with de-duplication, shared/own-only, statuses (`NO_POLL` > `NO_XI_SIZE` > single-team rule > matching), capacity-based augmenting-path matching (Kuhn with team capacities, deterministic player order), hint strings. It is built test-first with the spec's cases (covered, the 13/12/2 case asserting Tight, tight 15/14 with a 2+3 split, short 11/9 by 5 with 17 distinct, contention-only short, an augmenting-path case greedy fails, dedupe, group-poll slot never Covered, single team, no league, no poll, unsure never counted, different XI sizes, three teams, slotting rules, exact hint strings).
2. **Existing pieces to reuse:** `73`'s `AvailabilityHubLayout` switch (adds Coverage with `JoinInnerOutlinedIcon`, which exists in the installed `@mui/icons-material`); `gridHelpers.ts` (`dateHeading`, `kickoffText`, `slotLabel`); `listPlayerAvailability` with the Players query-key shape (`teamId: null`); `usePersistedListFilters`; `pickDefaultSeasonId`; `SectionTreeSelect`; `cardGridSx`; `badgeSx`/existing tones (`active`, `season`, `closed`, `muted`, `noPoll`); `EmptyState`.
3. **Filter panel style:** the Players page's panel `sx` is extracted into one shared constant used by both screens (behaviour unchanged) rather than a third copy; the builder places it next to the page-local code or in `utils/`, whichever matches the `073` `segmentedSwitch.ts` precedent.
4. **Group-poll slots can never be Covered** (the answer repeats for every team of the window); documented in the spec as a faithful reading, covered by a test.
5. **Process constraints carry over:** `source ~/.nvm/nvm.sh && nvm use 22.12.0`, one heavy command at a time with `uptime` checks, background + poll, no `git stash`, never touch the user's `CricketlegendApplication.java` / `055` / `058`; use file-level `configure({ asyncUtilTimeout })` for cold first renders instead of sleeps; stage commits with explicit paths only.

## Part 1 — Frontend (`frontend-builder`, in this order)

**F1. The util first (TDD):** `ui/src/pages/manage/availability/coverage/slotCoverage.ts` and `slotCoverage.test.ts` with fixture builders and every unit case in the spec's Unit row; exact hint strings asserted.
**F2. Page and pieces:** `AvailabilityCoveragePage.tsx` (filters Season/Section/League + Show past slots, persistence key `availabilityCoverage:filters:<clubId>`, one grid request held until seasons load, `listLeagues` XI map, team names via `listTeamsForClub` ("Unknown team" fallback), truncation `Alert`, loading/error/empty states, `cardGridSx` grid, count line), `SlotCoverageCard.tsx` (header + badge, summary line incl. `xs` wording, per-team `CoverageBar` rows, hint box, shared-player chips first 3 + expandable "+N", muted line, match breakdown), `CoverageBar.tsx` (12px track, solid own-only, striped shared from theme colours, 2px tick, scale `max(available, needed)`, `role="img"` + aria-label numbers), `CoverageLegend.tsx`; a test file for each.
**F3. Wiring:** `App.tsx` adds `coverage` child under the `availability` layout; `AvailabilityHubLayout` gets the third switch button and `/coverage` active rule (equal thirds on xs, New poll stays Polls-only); `ManagerDashboard` tile description "Polls, who is free, and squad cover"; the shared filter-panel style extraction used by `PlayerAvailabilityPage` and the new page. Update the `073` hub/dashboard tests for the third tab and description.
**Tests (Vitest/RTL):** the spec's Component row in full (cards, badges and tones, summary, bar widths/tick/aria-label, hint and chips, muted line, breakdown, legend, filters and persistence keys, request params with no `teamId` and `includePast`, waits for seasons, truncation, states, route + switch + tile text). No arbitrary timeouts.

## Order and ownership

1. `frontend-builder`: F1 (util + tests, run them green first), then F2, F3 and the component tests. I verify independently: `tsc -p tsconfig.app.json --noEmit`, `npm run lint`, `npm run build`, vitest (`--project unit --testTimeout=30000`) on `pages/manage/availability` (incl. `coverage/`), `PlayerAvailabilityPage`, `ManagerDashboard`, `AvailabilityHubLayout`, `utils` helpers touched.
2. `standards-reviewer` (read-only), focused on the matching algorithm's correctness, the status precedence and hint text against the spec, then standards; fix findings.
3. Docs by me in the same PR: `docs/roadmap.md` additions listed in the spec's Rollout Notes (dedicated endpoint, derby support, per-player rotation hints, considering picked players, link-through follow-ups).
4. Commits in chunks (`feat(ui)`, `test(ui)`, `docs`) with explicit paths, PR, CI; I ask before merging. Browser check by you (my tab is unreliable): the 074 spec's browser row.

## Flags for your review

1. **Verdict rules are the spec's** (strict Covered; Tight needs a particular split; Short by N from a maximum matching), computed client-side from the grid, so it inherits the grid's caps, own-teams-only and one-team-per-game (derby) limits, all shown on the page where relevant.
2. **Group-poll slots show Tight at best**, never Covered.
3. **The Players page is touched** only to share the filter-panel style (no behaviour change).
4. Playwright not extended (no live services), as before.

## Verification

- `tsc`, lint, build, touched-file vitest (full UI suite still has ~10-25 unrelated pre-existing 5s timeouts).
- Browser: Availability > Coverage tab appears third with equal thirds on a phone and no New poll; slot cards per date/Morning-Afternoon; badge, summary, per-team bars and tick, hint and shared chips as the mockup; a group-poll slot is never Covered; filters persist and Show past slots resets; truncation notice with wide filters; nothing scrolls sideways at 375px.
