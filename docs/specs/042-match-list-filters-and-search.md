# 042 — Match List Filters, Real Search, and Sort

**Depends on:** `029-league-management.md` (`Match`, `League`, `Season`, `Team` — every entity this spec reads from, none redefined here; also the origin of the still-open "search is accepted but ignored" gap this spec closes), `035-section-scoped-access.md` (`MatchRepository.findByClubIdAndSectionIdIn` — the query shape this spec's `Specification` refactor replaces), `037-match-improvements.md` (`upcomingOnly`, `ListToolbar.sortMinWidth` — both extended here), `041-list-screen-header-actions.md` (`ListToolbar.filters` — the single-filter slot this spec's multi-filter UI extends).
**Status:** draft.

## Problem & Goals

A live layout review of `MatchList`'s toolbar (conversation, screenshots) surfaced that the Search box has never actually worked: `ui/src/api/matchApi.ts`'s own `ListMatchesParams.search` comment already flags it — the frontend sends `search` as a query param, but `MatchController.list()` has no `search` parameter at all, so Spring silently drops it. Real search never shipped; only `sectionId`/`upcomingOnly` did. At the same time, the club admin asked for two more filters (League, Season) that don't exist on the backend at all yet, filters that narrow each other's own option lists rather than each staying independent, search that suggests real team names as you type, filter selections (not search) that persist across visits, and a sort control that's a compact arrow toggle instead of a long text dropdown — defaulting to soonest-upcoming-first, not furthest-future-first.

**Goals**
- `GET /matches` gains real, working `search`, `leagueId`, and `seasonId` filters, combinable with the existing `sectionId`/`upcomingOnly` in any combination — refactored onto Spring Data JPA `Specification`s rather than continuing the current method's hard-coded branch-per-combination shape, which doesn't scale past two optional filters.
- A new `GET /matches/filter-options` endpoint returns, for a given set of *other* active filters, which section/league/season ids are actually reachable — i.e. selecting one filter narrows what the other two even offer, rather than ever presenting a combination with zero possible matches.
- `MatchList`'s Search box gets live autocomplete suggestions, drawn from the club's own real `Team` names (already loaded client-side), narrowed by whichever Section/League/Season filters are currently active.
- Section/League/Season filter selections (not the Search text) persist in `localStorage`, scoped per club, so an admin doesn't have to re-apply them every visit.
- Sort becomes a compact icon toggle (ascending/descending by match date) instead of a `Select` with long text labels — defaulting to ascending ("soonest upcoming first"), not the current descending default.
- The toolbar already uses full horizontal width responsively without dead space (fixed live, ahead of this spec — see Rollout Notes).

## Non-goals

- **Applying any of this to another list screen's search/filter/sort.** Every other `/manage` list screen's Search remains exactly what it already is (client-side substring filtering, per each screen's own existing implementation — `029` never claimed otherwise for those screens). League/Season filters and the icon-sort-toggle are Match-specific; `ListToolbar.filters` stays a single-slot prop (`041`'s own Non-goal on a multi-filter array) — `MatchList` composes three filter controls itself, side by side, rather than `ListToolbar` growing a `filters: ReactNode[]`.
- **Fuzzy matching, relevance ranking, or full-text search.** `search` is a case-insensitive `LIKE %term%` against the match's own home/away team name (real `Team.name` via a join, or the free-text `homeTeamName`/`awayTeamName` when there's no real `Team`) — nothing smarter. Real future work if it's ever not good enough.
- **Autocomplete suggestions drawn from historical free-text opponent names.** Only the club's own real, already-loaded `Team` list is suggested — the exact wording of the resolved clarification: "hints... based on teams available." Suggesting past free-text opponent names too would need a new distinct-values backend query against an unbounded, paginated table; a real, separate future item if wanted.
- **Persisting the Search text itself.** Explicitly excluded per the original request — only Section/League/Season selections persist.
- **A third sort field or direction beyond match-date ascending/descending.** The icon toggle has exactly two states, matching the two `SORT_OPTIONS` `MatchList` already has today.
- **Any change to `upcomingOnly`'s own default-true behavior**, or to the underlying `Match`/`League`/`Season`/`Team` schema — this is a query-and-filter-shape spec, no migration.
- **Rolling `RecordCard`'s solid `background.paper` treatment out to other screens.** Named explicitly by the person who asked for this spec as real, wanted future work, deliberately deferred to its own separate pass — not decided or scoped here.

## User Stories

- As a club admin, typing in Search actually filters the match list server-side (previously a no-op), and shows live suggestions of the club's own team names as I type.
- As a club admin, I can filter by League and Season, not just Section — all three narrow the match list, and narrow each other's own available options so I never pick a combination with nothing in it.
- As a club admin, my Section/League/Season selections are still applied the next time I open this screen, without re-picking them — my Search text is not remembered.
- As a club admin, Sort is a single compact icon I click to flip between soonest-first and latest-first, not a dropdown with a long label — and the list already shows soonest-first by default.
- As a club admin using a screen reader, the sort toggle has a real accessible name describing its current state ("Sorted by match date, soonest first" or equivalent), not just a bare icon.

## Data Model Changes

None. Every field this spec filters or sorts on (`Match.leagueId`, `Match.seasonId`, `Match.homeTeamName`/`awayTeamName`, `Team.name`, `Team.sectionId`, `Match.matchDate`) already exists.

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/matches` (`029`, existing route) | `@access.canAccessClub`/section-scoped, unchanged | Gains three new optional query params: `search` (string — now actually wired, was silently ignored before), `leagueId` (UUID), `seasonId` (UUID). All combinable with existing `sectionId`/`upcomingOnly`. `sort` param unchanged (`matchDate,asc`/`matchDate,desc`, Spring's native `Pageable` sort). |
| `GET /api/v1/manage/clubs/{clubId}/matches/filter-options` (new) | same access rule as the list endpoint | Query params: `sectionId?`, `leagueId?`, `seasonId?`, `search?`, `upcomingOnly?` — the *currently selected* filters, same shape as the list call. Returns `{ sectionIds: UUID[], leagueIds: UUID[], seasonIds: UUID[], teamIds: UUID[] }`: the distinct ids actually reachable among matches matching every filter *except* the one each array represents (i.e. `sectionIds` is computed ignoring the caller's own `sectionId`, so selecting a Section doesn't make itself disappear from its own dropdown). `teamIds` is different in kind — it drives Search's own autocomplete suggestions rather than a picker's dropdown, narrowed by Section/League/Season like the other three but deliberately NOT by `search` itself (see Rollout Notes addendum below). The frontend already holds full `Section`/`League`/`Season`/`Team` objects (existing `listSections`/`listLeagues`/`listSeasons`/`listTeams` calls) — this endpoint returns ids only, to filter those already-loaded option lists, not duplicate name data. |

**Backend implementation note (not a new decision, a documented mechanical requirement):** `MatchServiceImpl.list()`'s current shape is four hard-coded branches for `sectionId × upcomingOnly`. Adding `search`/`leagueId`/`seasonId` as further independent optional filters the same way would require `4 × 2 × (leagueId set/unset) × (seasonId set/unset) × (search set/unset)` branches — refactor `MatchRepository`'s query path onto Spring Data JPA `Specification`s (`JpaSpecificationExecutor<Match>`), composing one `Specification` per active filter and `.and()`-ing them together, so an arbitrary combination of optional filters is one code path, not an exponential one. `findByClubIdAndSectionIdIn`'s existing JPQL subquery-join-against-`Team`-by-field-value shape (`035`) becomes one of these composable specifications, ported as-is, not redesigned.

## UI Requirements

**`ui/src/pages/manage/MatchList.tsx`** (existing, edited):
- Replaces the single `SectionTreeSelect` passed to `ListToolbar.filters` with three controls, laid out together (Section, League, Season) — still passed as one `filters` slot value (a `Stack`/`Box` grouping all three), matching `041`'s "single slot" contract from `ListToolbar`'s own side.
- League/Season are `Input select`s (matching `SectionTreeSelect`'s own visual weight), populated from the club's already-loaded `leaguesById`/`seasonsById` — no new fetch.
- New `useQuery` for `GET /matches/filter-options`, re-fetched whenever any of `sectionId`/`leagueId`/`seasonId`/`debouncedSearch`/`upcomingOnly` changes; each of the three Selects' own option list is filtered client-side against that response's matching id array (Section/League/Season names/objects the client already has, narrowed to reachable ids only) — an option outside the reachable set is not offered, not just disabled, to keep the list short.
- **Search autocomplete**: the existing `Input` gains an `Autocomplete`-backed suggestion list (MUI `Autocomplete`, `freeSolo` — typing anything and pressing Enter/blur still searches by raw text, matching a suggestion just fills it in), sourced from `teamsById`'s own names (already loaded), filtered client-side to those matching the currently-typed substring — no new endpoint for this, it's the same team data the card titles already resolve names from.
- **Persistence**: `sectionId`/`leagueId`/`seasonId` (not `search`, not `sort`) are read from `localStorage` (`matchList:filters:${clubId}`) on mount and written back on every change — a small local `usePersistedFilters`-shaped hook or inline `useEffect`, following this repo's existing `try/catch`-wrapped defensive `localStorage` access convention (see `docs/standards/frontend.md`/any existing `localStorage` call site for the exact guard shape — never let a blocked/unavailable `localStorage` throw and break the page).
- **Sort**: the `ListToolbar` `Select`-based sort is replaced, for this screen only, with a compact `IconButton` (`ArrowUpwardIcon`/`ArrowDownwardIcon`, swapping per direction) cycling between `matchDate,asc` and `matchDate,desc`, with `aria-label` reflecting the *resulting* state ("Sort by match date, soonest first" / "...latest first") — see `ListToolbar` changes below for exactly how this is exposed without turning every other list's Sort into an icon too.
- Default `sort` state changes from `SORT_OPTIONS[0].value` (`matchDate,desc`) to `matchDate,asc`.

**`ui/src/components/ListToolbar/ListToolbar.tsx`** (existing, edited):
- New optional prop `sortToggle?: { value: 'asc' | 'desc'; ascLabel: string; descLabel: string; onToggle: () => void }`. When passed, it replaces the `Select`-based Sort rendering entirely with the compact `IconButton` described above; when omitted (every other current call site), Sort renders exactly as it does today. This is additive/optional, matching every other prop this component has grown (`041`'s `filters`, `037`'s `sortMinWidth`).

**`ui/src/api/matchApi.ts`** (existing, edited):
- `ListMatchesParams` gains `leagueId?: string` and `seasonId?: string`; `search`'s existing doc comment (flagging it as previously-ignored) is removed/updated now that it's real.
- New function `listMatchFilterOptions(clubId, params): Promise<{ sectionIds: string[]; leagueIds: string[]; seasonIds: string[]; teamIds: string[] }>` calling the new endpoint.

Mobile-first: Section/League/Season stack as their own rows at 375px (same `xs`-full-width pattern `041` already established for the single-filter case); the sort `IconButton` stays reachable and correctly labeled at every breakpoint.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit (backend) | `MatchServiceImplTest`/a repository-level test — `search` matches a real `Team`'s name and a free-text opponent name, case-insensitively; `leagueId`/`seasonId` filter correctly; all five filters (`sectionId`, `upcomingOnly`, `search`, `leagueId`, `seasonId`) combine correctly together, including all-omitted (unchanged existing behavior) and all-five-set. `filter-options` — for a fixed set of matches across multiple sections/leagues/seasons, confirm each returned id array reflects the *other* filters only (not narrowed by its own current selection), and confirm it's still scoped to the caller's own accessible sections (section-scoped `CLUB_ADMIN`). |
| Component | `MatchList.test.tsx` — Section/League/Season each narrow to the `filter-options` response; selecting one triggers a re-fetch of the other two's option sets; Search suggests matching team names and both a suggestion-click and free-text Enter both trigger the real backend search param; `localStorage` round-trip (set, reload, still applied) for the three filters and confirmed absence of persisted `search`; the sort `IconButton` toggles value and `aria-label` correctly, defaulting to ascending. `ListToolbar.test.tsx` — `sortToggle` renders the icon button instead of the Select when passed, and every existing test (which doesn't pass it) is unaffected. |
| Contract | OpenAPI schema diff for `GET /matches`'s three new query params and the new `GET /matches/filter-options` endpoint. |
| End-to-end | Extends the existing league-management golden path: type a partial team name into Search, confirm the real (not client-side) filtered result via a mocked/real backend call; select a League, confirm Season's own option list narrows; reload the page, confirm the same Section/League/Season selections are still applied and Search is empty. |

## Acceptance Criteria

- Typing in Search actually filters matches server-side — confirmed by a request assertion, not just a rendered result (the current no-op gap must be visibly closed, not just coincidentally masked).
- League and Season filters exist, work, and narrow the match list exactly like Section already does.
- Selecting any one of Section/League/Season narrows the *other two's* own option lists to combinations that actually have matches.
- Reloading the page reapplies previously-selected Section/League/Season filters, but never a previous Search term.
- Sort defaults to soonest-upcoming-first and is a single accessible icon toggle, not a text dropdown.
- No other `/manage` list screen's Search/Sort/filter behavior changes.

## Rollout Notes

- **This spec ships as its own PR on top of `041`** (already merged) — real backend work this time (the `Specification` refactor plus a new endpoint), not frontend-only.
- **The `Specification` refactor is the one piece of this spec most likely to need its own careful review** — it changes `MatchRepository`'s query mechanism for every existing caller of `list()`, not just the three new filters. Existing behavior (all four current branch combinations) must be byte-for-byte preserved by the refactor, verified by the existing `MatchServiceImplTest` suite continuing to pass unmodified, plus the new combined-filter tests.
- **The card-background rollout to other screens** (raised in the same conversation as this spec, "up to you" on sequencing) is real, wanted, separate future work — track it as its own small follow-up once this ships, not folded in here.
- **A human should confirm `docs/roadmap.md`** picks up anything this spec's own Non-goals name as still-deferred (historical free-text opponent name suggestions, the card-background rollout) once this ships.
- **Post-build addition, from a real user-reported bug during manual testing:** Search's autocomplete suggestions were originally sourced client-side from the entire already-loaded `teamsById` (every team in the club), not narrowed by the active Section/League/Season filters — so a team with no match in the currently-filtered view could still be suggested while typing (reported live: a team from a different League/Section appeared as a suggestion under an unrelated League filter). Fixed by adding `teamIds: UUID[]` to `filter-options`'s response (see API Contract above), computed the same way as `sectionIds`/`leagueIds`/`seasonIds` — narrowed by whichever of Section/League/Season the admin has picked — but deliberately excluding `search` itself from that computation, since narrowing suggestions by the very text being typed would make them disappear as soon as they became useful. The frontend's `searchSuggestions` now filters `teamsById` by this array before applying the typed substring match. Covered by `MatchRepositoryTest.filterOptionsTeamIdsIgnoresSearchWhileSectionLeagueAndSeasonIdsAreNarrowedByIt` (real DB, proves the search-exclusion specifically) and a frontend regression test in `MatchList.test.tsx`.
- **Post-review fix, found by `standards-reviewer`, not user-reported:** `filterOptions()`'s `sectionIds` ancestor-closure walk (API Contract above) originally climbed `Section.parentSectionId` all the way to the club's true root regardless of the caller's own section-scoped access boundary, since the parent/child map it walks is built from the *entire* club's section tree, unrestricted. A SECTION-scoped restricted `CLUB_ADMIN` could therefore receive ancestor section ids above their own grant root in the `filter-options` response (never in `list()` itself — only this one array). Fixed by capping the walk at the caller's own accessible-section set, mirroring the same restriction `list()`/the rest of `filterOptions()` already enforce. Covered by a new `MatchServiceImplTest` regression case for a restricted caller.
