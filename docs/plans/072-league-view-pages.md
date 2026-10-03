# Plan 072 — League View Pages

Implements `docs/specs/072-league-view-pages.md` (approved; design approved). Design: https://claude.ai/artifact/SkLSFF8G4yaTUqJ4cJvmQo (version 10). Branch: `feature/072-league-view-pages` (off master; specs 071 and 072 committed as `8e99386`). Frontend only: no backend, migration or `openapi.yaml` change. Built first; `071` follows on its own branch/PR.

## Context

`LeagueDetailPage` is one long page with a hero Schedule card, Details, Contacts, Teams and Conditions stacked, loads only the first 20 matches (truncating schedules and the next-match countdown), and gives its parts no addresses. The spec splits it into three routed views (Schedule, Teams, Conditions) under one always-visible header carrying the contact people and links, loads every match of the season, and labels the conditions PDF "Playing Conditions.pdf".

## Findings that shape the plan

1. **Routes today** (`ui/src/App.tsx` L186-197): `fixtures/leagues/:leagueId` -> `LeagueDetailPage`; `edit`, `contacts/...` siblings. Becomes a layout route with `index` (replace-redirect keeping the query string), `schedule`, `teams`, `conditions` children. `LeagueContactDetailPage` links to the bare league URL, which keeps working through the redirect. The comment at App.tsx ~L191-192 mentions `LeagueDetailPage`'s Contacts section and needs a wording update.
2. **`LeagueDetailPage` (710 lines) is deleted**; its data fetching, `contactBadgeFor`/quick-view setup, `LeagueTeamTile`, share handlers (`handleSharePdf/Poster/Calendar`, `shareTeams`, `handleSharePlayingConditionsPdf`) and `DetailFieldGrid` conditions rows are redistributed (moved, not rewritten). `badgeFor`/`leagueSeasonBadges`/`leagueRecordFields` stay exported from `LeagueList.tsx` for now (071 replaces them); the builder must grep for any other importer of `LeagueDetailPage` or those helpers before deleting.
3. **`listMatches`** (`api/matchApi.ts` L126) is the only matches call; `listAllMatches` is new (pages of 200, `sort: 'matchDate,asc'`, stop at 25 pages). The builder verifies `listMatches` already passes `size` and `sort`; if it does not, extend its params additively. `LeagueFormPage`'s Schedule tab has the same `page: 0` call and gets the same helper.
4. **Shared components all change additively:** `RecordCard` badge tones `format`/`season`/`active` (+ purple structural token in `ui/src/theme.ts`, documented in `docs/standards/design-system.md` via the `design-token-sync` skill), `RecordIconButton` `compact`, `DocumentUpload` `displayName`. Stories and tests updated for each.
5. **Season state in the URL** (`?seasonId=`): effective id = valid query param else `pickDefaultSeasonId(seasons)`; only user changes are written (`replace: true`); switcher links and the index redirect carry `location.search`. Layout owns queries and passes `clubId`, league, seasons, selected season, affiliations/teams/league teams/contacts through `<Outlet context>`.
6. **Machine/process constraints from earlier sessions** carry over: `source ~/.nvm/nvm.sh && nvm use 22.12.0`, one heavy command at a time, `uptime` first, background + poll, no `timeout`, zsh (xargs for file lists), no `git stash`, never touch the user's `CricketlegendApplication.java`/`055`/`058`.

## Part 1 — Shared pieces and API (`frontend-builder`, first)

**F1.** `api/matchApi.ts`: `listAllMatches(clubId, { leagueId, seasonId })` per spec + unit tests. `api/leaguePlayingConditionsApi.ts`: export `PLAYING_CONDITIONS_PDF_NAME`. `theme.ts`: purple token (`#7B5CC4` / `#5B3D99`); run the `design-token-sync` skill so `docs/standards/design-system.md` gets its row and the new tone mentions. `RecordCard`: tones `format`, `season`, `active` (+ tests + story). `RecordIconButton`: `compact` (+ test + story). `DocumentUpload`: `displayName` (+ test + story). `pages/manage/leagues/leagueBadges.ts` (+ test) per spec section 6.

## Part 2 — Layout, views, routes (`frontend-builder`)

**F2.** New `ui/src/pages/manage/league/`: `LeagueViewLayout.tsx` (guards, queries, season-in-URL, derived values, contact quick view, header rows 1-3 exactly as spec section 3 including phone stacking, switcher as MUI `Tabs` of `RouterLink`s keeping the query string, `<Outlet context>`), `LeagueScheduleView.tsx` (Fixtures card, Share schedule, `NextMatchCountdown`, `LeagueFixtures`, `ShareScheduleDialog`, `listAllMatches` with key `['managed-club', clubId, 'leagues', leagueId, 'matches', selectedSeasonId]`), `LeagueTeamsView.tsx` (Our teams with linked `LeagueTeamTile`, League teams unlinked, vertical 120px tiles, empty copy), `LeagueConditionsView.tsx` (Playing conditions card, "Playing Conditions.pdf" button, Share, `DetailFieldGrid`, empty copy). `App.tsx`: layout route + children + redirect; remove `LeagueDetailPage` import and route; update the stale comment.
**F3.** `LeagueFormPage.tsx`: Schedule tab uses `listAllMatches`; Playing Conditions tab passes `displayName={PLAYING_CONDITIONS_PDF_NAME}`. Delete `LeagueDetailPage.tsx` and its test after carrying its still-relevant cases into the new tests.

**Tests (Vitest/RTL, `frontend-builder`; `test-writer` only if gaps remain):** everything in the spec's Test Plan row: routes and redirect, header row order and contents, Back to Leagues target on all views, badges and team count, links row and social slot, contact people before links row and quick view, Season default/valid/invalid/replace, switcher query string and active tab, Schedule 45-match three-page regression, Teams groups and links, Conditions label and empty copy, shared piece tests, `LeagueFormPage` additions. No arbitrary timeouts.

## Order and ownership

1. `frontend-builder`: F1, then F2, then F3 + tests, in that order, one heavy command at a time. I verify independently: `tsc -p tsconfig.app.json --noEmit`, `npm run lint`, `npm run build`, vitest (`--project unit --testTimeout=30000`) on `src/pages/manage/league`, `LeagueFormPage`, `LeagueList`, `LeagueContact*`, `RecordCard`, `RecordIconButton`, `DocumentUpload`, `leagueBadges`, `matchApi`; Storybook type-check through `tsc`.
2. Docs by me in the same PR: `docs/roadmap.md` items listed in the spec's Rollout Notes, `062` Status line updated to "superseded by 072", `design-system.md` (through the token-sync skill).
3. Browser check after you reload the dev server: Schedule, Teams, Conditions views, header at phone/two-column/wide, deep links, Back, season persistence, long schedule, edit screen PDF label. If my browser tab is unreliable you get a short checklist.
4. `standards-reviewer` (read-only), fix findings, commit in chunks (`feat(ui)`, `test(ui)`, `docs`), PR, CI; I ask before merging. Then plan/build `071` on its own branch off the merged master.

## Flags for your review

1. **`LeagueDetailPage` and its test are deleted**; their cases are carried over, not dropped.
2. **Purple becomes a structural theme token** (spec section 6), documented in the design-system doc.
3. **`listMatches` may need a small additive change** if it does not already pass `size`/`sort`; no behaviour change for existing callers.
4. **`LeagueFormPage` is touched** (schedule truncation and PDF label), as the spec says.
5. **Playwright not extended** (no live services), as before.

## Verification

- `tsc`, lint, build, touched-file vitest (full UI suite still has ~10-25 unrelated pre-existing 5s timeouts).
- Browser: open a league from the list (still the old card until `071`): lands on Schedule; switch views; season survives; a season with more than 20 matches shows all and the right next match; Conditions PDF reads "Playing Conditions.pdf" here and on the edit screen; contact avatar opens quick view; social icons and links in the header; "Back to Leagues" returns to the list.
