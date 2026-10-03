# 071 — League Card Redesign

**Depends on:** `072-league-view-pages.md` (**built first**: the Schedule, Teams and Conditions routes this card's buttons open, the `leagueBadges` helper and the new `format`/`season`/`active` badge tones it introduces), `069-match-card-redesign.md` (the card this one mirrors: `RecordCard` `footerButtons`, `badgesAbove`, `titleWrap`, the stacked `DetailLine`s, the `SelectionBlock` progress bar, batched list fields, non-list paths returning null), `066-poll-close-time-and-unified-cards.md` and `064`–`068` (the poll card the match card copies, `utils/cardGrid.ts`), `070-league-teams.md` (league teams, listed after the club's own teams on the card), `050-league-schedule-and-fixtures.md` (`LeagueDto.currentSeason*` fields, the "current season" rule `resolveCurrentSeasonId` ported from `defaultSeason.ts`, the existing `LeagueList` card this replaces, `nextMatchCountdown.ts`), `029-league-management.md` (`League`, `Season`, `LeagueAffiliation`, `Match`), `053-league-extended-profile.md` (`format`, `logoUrl`, `website`, `socialLinks`), `052-league-playing-conditions.md` (the Playing Conditions PDF whose card shortcut is removed), `059-record-card-click-to-view.md` (the stretched-link card click), `042-match-list-filters-and-search.md` and `docs/standards/frontend.md` (list toolbar, `usePersistedListFilters`), `055-league-season-config.md` (draft, read only: see Rollout Notes).
**Status:** approved (design approved by the user). Design: https://claude.ai/artifact/SkLSFF8G4yaTUqJ4cJvmQo

## Problem & Goals

The Leagues list card is a flat summary: name, a team-count and season badge, two fields and a text "Playing Conditions" button. It says nothing about how the season is going (when it starts, what is next, how many matches are done), who is in it, or where to go from it, and it looks unlike the Match card (`069`) and the poll card the user rates as the benchmark. This spec rebuilds the card on the same bones as the Match card, adds season-progress information computed on the server, and gives the list the same grid and a Format filter.

**Goals**
- The league card is a `RecordCard` like the match card: colour-coded badges above a wrapping title, stacked detail lines with icons, a progress block, a team avatars row, a social links row and a four-button icon-over-caption footer with the divider above.
- The card shows, for the league's current season: first, next and last match dates, matches played out of scheduled, and every team in the season (the club's own and the registered league teams).
- The footer's Schedule, Teams and Conditions buttons open the matching `072` view directly; Edit opens the edit screen; clicking the card opens the Schedule.
- The list uses the shared equal-height card grid and gains a persisted Format filter beside search and sort.
- The extra data arrives as additive fields on the existing leagues list response, computed in batched queries (no N+1).

## Non-goals

- **A real "completed" or results status for matches.** No status or result field exists on `Match`; none is added here. For this card, "played" simply means an active match of the current season whose `matchDate` is in the past by the server clock, so a rescheduled match just moves by date and an inactive match is excluded. A true completed/result status belongs to the future match-results spec; when it exists, "played" and the progress block should read it instead (Rollout Notes, roadmap).
- **Match naming.** Matches have no name field and none is added. The user intends to add naming (for example "Final") later; the **Last match** line shows the date only for now and should show the name beside the date once matches can be named (roadmap).
- **A cap or "+N more" on the team avatars.** All teams are shown and the row wraps; the card simply grows taller (the shared grid keeps cards in a row equal height).
- **Depending on draft `055`.** The Playing XI size and Age range lines keep reading `League.maxPlayingXiSize`/`minAge`/`maxAge` exactly as the current card does. When `055` moves those fields to `LeaguePlayingConditions` the card will read them from there; this spec neither anticipates nor blocks that.
- **Any season other than the current one.** The card is about the club's current season (the same rule `LeagueDto.currentSeason*` already uses); there is no season picker on the list.
- **A new endpoint, paging or server-side filtering.** The list stays a plain client-side array (a club's leagues are a small bounded set, `029`), so the Format filter is client-side too.
- **Muting inactive cards.** The approved mockup dims an inactive card's body; `RecordCard` has no such option and the grey **Inactive** badge carries the signal. Not built.
- **Changing the view pages.** `072` owns those; this spec only links to them.
- **Changing `currentSeasonTeamCount`, `currentSeasonLabel` or `currentSeasonPlayingConditionsUrl`.** They stay on `LeagueDto` unchanged (the card now takes its team count from the new `teams` list, and no longer reads the conditions URL), so no existing client breaks; retiring them is a possible later cleanup (roadmap).
- **Deactivating or reactivating from the card.** Stays on the edit screen (`038`); there is no corner action.

## User Stories

- As a manager, I see each league as a card with its logo, wrapping name and colour-coded badges (format, team count, current season, Active/Inactive), like a match card.
- As a manager, I see when the league's first and last matches are and when the next one is, with "in N days", "today" or "tomorrow" beside it, so I can see where the season stands.
- As a manager, I see how many matches have been played out of how many are scheduled, with a progress bar, or a plain "No matches scheduled yet".
- As a manager, I see every team in the current season on the card: my own teams first, then the league's other teams, each with its abbreviation.
- As a manager, I see the league's website and social links as icons on the card and can open them without opening the league.
- As a manager, I open a league's Schedule, Teams or Conditions straight from the card's footer, or Edit it; clicking the card opens the Schedule.
- As a manager, I filter the leagues by format, together with search and A-Z/Z-A sort, and the format choice is remembered next time.
- As a manager on a phone, I see one card per row with the footer never clipped.

## Data Model Changes

None. Every value is computed at read time from existing tables (`match`, `league_affiliation`, `team`, `league_team` from `070`, `season`).

## API Contract

No new endpoint. `GET /api/v1/manage/clubs/{clubId}/leagues` (`LeagueController.list`, access `canAccessClub`/as today, plain array, unpaginated, unchanged) returns `LeagueDto` with **additive fields**, all computed for the club's **current season** (`LeagueServiceImpl.resolveCurrentSeasonId`, unchanged) in batched queries:

| New `LeagueDto` field | Type | Meaning |
|---|---|---|
| `matchCount` | `Integer` | Active matches of the league in the current season |
| `playedCount` | `Integer` | Of those, matches with `matchDate < now` |
| `firstMatchDate` | `Instant` (nullable) | Earliest `matchDate` among those matches; null when none |
| `lastMatchDate` | `Instant` (nullable) | Latest `matchDate` among those matches (past or future); null when none |
| `nextMatchDate` | `Instant` (nullable) | Earliest `matchDate` among those matches with `matchDate >= now`; null when none |
| `teams` | `List<LeagueSeasonTeamDto>` | Every team in the season: the club's own affiliated teams first, then the active league teams; see below |

`LeagueSeasonTeamDto` (new, `com.cricketlegend.dto`): `String name`, `String abbreviation` (nullable), `String logoUrl` (nullable), `boolean own`.

**Definitions (precise):**
- "Active match": `Match.active = true`, `Match.clubId` = the club, `Match.leagueId` = the league, `Match.seasonId` = the current season. A match with no league is never counted.
- `now` is read **once per `list()` call** (a new `ServerClock.now()` beside `startOfToday()`, `Instant.now()`) and passed to the repository, so the three aggregates always agree and `playedCount + (matches with matchDate >= now) = matchCount` exactly. It is the server clock, in UTC instants; no per-club timezone (`ServerClock`'s existing posture).
- `nextMatchDate` uses `>=` where the UI's `resolveNextMatchCountdown` uses a strict `>`; they can differ only for a match at the exact current instant, which is immaterial. The card does not run the countdown util over a match list (it has none); it only reuses the util's day-label rule (see UI Requirements).
- `teams`, own group: distinct `Team`s with a `LeagueAffiliation` for this league and the current season, sorted by `lower(name)`; same population the existing `currentSeasonTeamCount` counts (no filter on `Team.active`). `own = true`, `abbreviation`/`logoUrl` from `Team`.
- `teams`, league-team group: `LeagueTeam` rows for this league and the current season with `active = true`, sorted by `lower(name)`, `own = false`. Inactive league teams are never listed. The final list is own group then league-team group, each already sorted by name; the UI does not re-sort.
- When the club has no seasons (no current season): `matchCount = 0`, `playedCount = 0`, the three dates null, `teams` empty. No batch query runs.
- **Other `LeagueDto`-returning paths** (`create`, `update`, `deactivate`, `reactivate`, and any `get`) leave all six new fields **null** (precedent: `MatchDto`'s non-list fields, `069`); the card only ever reads the list response. `LeagueMapper.toDto` gains `@Mapping(target = ..., ignore = true)` for the six fields, as it already has for `currentSeason*`, and `LeagueServiceImpl.withCurrentSeasonFields` fills them (a small private holder record replaces its growing argument list).

**Batched queries (new; each runs exactly once per `list()` call, none per league):**

| Repository method | Shape |
|---|---|
| `MatchRepository.summariseByLeagueForSeason(clubId, seasonId, now)` | One JPQL aggregate over `Match m where m.clubId = :clubId and m.seasonId = :seasonId and m.active = true and m.leagueId is not null group by m.leagueId`, projecting `leagueId`, `count(m)`, `sum(case when m.matchDate < :now then 1 else 0 end)`, `min(m.matchDate)`, `max(m.matchDate)` and `min(case when m.matchDate >= :now then m.matchDate end)`, via an interface projection (`LeagueMatchSummary`) in the same file, following the `LeagueAffiliationRepository.LeagueTeamCount` precedent. Leagues with no matches are absent (the service defaults them to 0/null) |
| `LeagueAffiliationRepository.findTeamSummariesBySeasonId(seasonId)` | `select a.leagueId, t.name, t.abbreviation, t.logoUrl from LeagueAffiliation a, Team t where a.teamId = t.id and a.seasonId = :seasonId order by lower(t.name), t.name`, interface projection, grouped by `leagueId` in the service |
| `LeagueTeamRepository.findActiveBySeasonId(seasonId)` | `select t from LeagueTeam t where t.seasonId = :seasonId and t.active = true order by lower(t.name), t.name`, grouped by `leagueId` in the service |

Seasons are club-owned (`SeasonRepository.findByClubId` supplies the current season), and affiliations and league teams can only be created for a league and season of the same club (`LeagueSeasonAccessValidation`), so scoping the last two queries by `seasonId` cannot leak another club's rows; the match query adds `clubId` as well. With the two existing batches (`countDistinctTeamsBySeasonId`, `LeaguePlayingConditionsRepository.findBySeasonId`) a `list()` call is a fixed number of queries regardless of how many leagues the club has. `LeagueDto` is a record: its constructor call sites (`LeagueServiceImpl`, tests) are updated.

`backend/openapi/openapi.yaml` is updated by hand, additions only: the six `LeagueDto` properties and the new `LeagueSeasonTeamDto` schema. No existing field or endpoint changes.

## UI Requirements

Built on the shared `RecordCard` (`footerButtons`, `badgesAbove`, `titleWrap`, `viewTo`, `children`), the shared card grid (`utils/cardGrid.ts`) and `ListToolbar`, exactly as `MatchList`/`MatchCard` (`069`). `ui/src/api/leagueApi.ts`: `League` gains `matchCount: number | null`, `playedCount: number | null`, `firstMatchDate`, `lastMatchDate`, `nextMatchDate: string | null`, `teams: LeagueSeasonTeam[] | null` with `LeagueSeasonTeam { name; abbreviation: string | null; logoUrl: string | null; own: boolean }`.

### 1. Shared pieces extracted or extended (reuse before write)

- **`DetailLine`** (today a private function in `ui/src/pages/manage/matches/MatchCard.tsx`): extracted to `ui/src/components/DetailLine/` (four-file anatomy: component, test, story, `index.ts`), `value` widened from `string` to `ReactNode`, with optional `labelWidth` (default 56, so the Match card is unchanged) and `muted` (secondary-colour value, for "Not scheduled yet"). `MatchCard` imports it; the league card passes `labelWidth={78}`.
- **`CardProgressBar`**: the 10px rounded track (`grey.400`) with a `primary.main` fill and its `role="progressbar"` attributes, today inline in `ui/src/pages/manage/matches/SelectionBlock.tsx`, extracted to `ui/src/components/CardProgressBar/` (four files; props `value`, `max`, `ariaLabel`, `valueText`). `SelectionBlock` uses it unchanged in behaviour; the league progress block uses it too. Existing `SelectionBlock`/`MatchCard` tests must pass untouched.
- **`SocialLinksRow`** (`ui/src/components/marketing/SocialLinksRow`): add `website` to its platform union, icon map (`LanguageOutlined`) and label map ("Website"), so a website can be rendered as the first icon through the same component. Additive; test and story updated.
- **`ui/src/utils/nextMatchCountdown.ts`**: extract the existing day-diff logic into an exported pure `resolveCountdownLabel(matchDate: string, now: Date): { label: 'today' | 'tomorrow' | 'days'; value?: number }` (local calendar days, midnight to midnight, exactly the current rule: `<= 0` today, `1` tomorrow, else days) and have `resolveNextMatchCountdown` call it; behaviour and tests unchanged. The card uses it for the "in N days" badge so the card and the Schedule countdown never state it differently.
- **`ui/src/pages/manage/availability/pollHelpers.ts`**: add `formatMatchDate(iso)` beside `formatMatchDateTime` (weekday short, day, month short, year, e.g. "Sat 3 Oct 2026").

### 2. `LeagueCard` (page-local, `ui/src/pages/manage/leagues/LeagueCard.tsx`, replacing the private card in `LeagueList.tsx`)

`RecordCard` props:

- `title={league.name}`, `titleWrap`, `badgesAbove`, `avatar={{ imageUrl: league.logoUrl, fallback: <EmojiEventsOutlinedIcon fontSize="small" />, shape: 'rounded' }}` (logo with trophy fallback).
- `viewTo` = `/manage/fixtures/leagues/${league.id}/schedule` (clicking the card opens the Schedule).
- `badges` = `leagueBadges(league, { teamCount: league.teams?.length ?? 0, seasonLabel: league.currentSeasonLabel })` from `072`'s helper, in this order and colour: **format** (purple, only when set), **N teams** (blue; "1 team" singular; counts own plus active league teams, so it equals the avatars below), **current season label** (amber, only when there is a current season), **Active** (green) / **Inactive** (grey).
- `footerButtons` (four equal columns, icon over a single short caption, the divider above; the shared footer styling), in order: **Schedule** (`EventOutlinedIcon`, navigates to `.../schedule`), **Teams** (`GroupsOutlinedIcon`, `.../teams`), **Conditions** (`DescriptionOutlinedIcon`, `.../conditions`; always enabled, the view shows its own empty state when there are no conditions or PDF), **Edit** (`EditOutlinedIcon`, `.../edit`). The old "Playing Conditions" PDF secondary action is removed (the PDF opens from the Conditions view); `viewTo`/`editTo`/`secondaryActions` are not passed.
- `children` (the body slot, top to bottom):
  1. **Stacked details** (`DetailLine`, `labelWidth` 78, small icon, label, value; `Stack spacing={1.25}`):
     - **First match** (`EventOutlinedIcon`): `formatMatchDate(firstMatchDate)`; "Not scheduled yet" (muted) when null.
     - **Next match** (`UpcomingOutlinedIcon`): `formatMatchDateTime(nextMatchDate)` ("Sat 17 Oct, 10:00") followed by a solid green badge (the `open` tone, `Chip size="small"`) reading "in N days", "today" or "tomorrow" from `resolveCountdownLabel(nextMatchDate, new Date())`; "None scheduled" (muted) when null.
     - **Last match** (`FlagOutlinedIcon`, after Next match): `formatMatchDate(lastMatchDate)`, the latest active match of the season whether past or future (so with one match, First and Last show the same date); "Not scheduled yet" (muted) when null, the same wording as First match. No match name (see Non-goals).
     - **Playing XI** (`GroupsOutlinedIcon`): `"{league.maxPlayingXiSize} players"`, as today's field, always shown.
     - **Age range** (`CakeOutlinedIcon`): `"{minAge ?? 'Any'}–{maxAge ?? 'Any'}"`, shown only when at least one of `minAge`/`maxAge` is set (today's rule), omitted otherwise.
  2. **Progress block** (divider above): a heading row "Matches played" with "N of M" on the right (`playedCount` of `matchCount`), a `CardProgressBar` (`value` played, `max` M), and a caption "N played · K to go". With `matchCount` 0 the heading shows "0 of 0", the bar is empty and the caption reads "No matches scheduled yet". `matchCount`/`playedCount` null is treated as 0.
  3. **Team avatars row** (divider above; page-local `LeagueTeamAvatars`): every entry of `teams` in the order received (own affiliated teams first, then league teams), no cap and no "+N", wrapping onto further lines. Each item is a column of an avatar over a caption, 46px wide: a 34px circular `Avatar` (the logo when present, else the abbreviation, else `initialsFromName(name)`); **own** teams solid `avatarSx` primary with white text, league teams the neutral style (primary-tinted wash `alpha(primary.main, 0.12)`, `primary.dark` text, `divider` border); the caption under it is the abbreviation (fallback: initials of the name), 10.5px, 600, `text.secondary`, single line with ellipsis. The full team name is the item's `title` and `aria-label`. Empty (or null) shows "No teams registered for this season" in muted text.
  4. **Social links row** (omitted when there are none): a top divider, then `SocialLinksRow size="small"` fed `[ ...(league.website ? [{ platform: 'website', url: league.website }] : []), ...league.socialLinks ]` (the website icon first when set, then the social links, in their stored order), left-aligned with a slight negative inline margin so the first icon aligns with the text. The row is wrapped in a `position: 'relative'` box so its links paint above the card's stretched title link (as the footer already does) and are clickable without opening the league. Website URLs are already validated to start with `http(s)://` by `LeagueForm`.
- Cards in a row are equal height with the footer pinned to the bottom (`RecordCard`'s own height and `cardGridSx`'s `alignItems: stretch`); a card with many teams is simply taller.

### 3. `LeagueList` (`ui/src/pages/manage/LeagueList.tsx`)

- Grid: `<Box sx={cardGridSx}>` (the shared util: `repeat(auto-fill, minmax(min(380px, 100%), 1fr))`, `gap: 2`, `alignItems: stretch`) replaces the hard-coded `1 / 2 / 3` columns.
- Toolbar: `ListToolbar` keeps the name search and the A-Z/Z-A `sortToggle` (the standards' required sort pattern) and gains one `filters` control, **Format**: a single-select `Input select` labelled "Format" with an "All formats" option (value empty) followed by every `LeagueFormat` in `LEAGUE_FORMAT_LABELS` order. Client-side: `visibleLeagues` also filters on `league.format === selected`. Persisted per club with `usePersistedListFilters(\`leagueList:filters:${clubId}\`, { format: '' })` (not required by the standards for a client-side filter; the user asked for it). Search stays a plain non-persisted `useState`. A persisted format that matches nothing shows the existing "No matching leagues" empty state, whose copy mentions the format when one is selected, and "All formats" clears it.
- Data and states unchanged: `listLeagues` with key `['managed-club', clubId, 'leagues']`, the "Not authorized", error, "No leagues yet" and "No matching leagues" states, `ManageScreenHeader` with "Add League".
- **Exported helpers.** `badgeFor`, `leagueSeasonBadges` and `leagueRecordFields` are no longer used by the card or by anything else once `072` has deleted `LeagueDetailPage` (their only other importer), so they are **deleted** from `LeagueList.tsx`; `leagueBadges` (`072`) replaces the badge pair and the card's detail lines replace `leagueRecordFields`. Their existing tests in `LeagueList.test.tsx` are rewritten against the new card, not kept for dead code.
- Phone: one column (the grid's `min(380px, 100%)`), the same card, the footer's four columns never clipped.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit (backend) | `LeagueServiceImplTest.list`: with a current season, populates `matchCount`, `playedCount`, `firstMatchDate`, `lastMatchDate`, `nextMatchDate` and `teams` per league from the batch results; a league with no matches gets 0/0/null/null/null; teams are own first then league teams, each in name order; inactive league teams excluded; no current season gives 0/0/null and empty teams with none of the three new batch methods invoked; **batch guard**: each new repository method called exactly once per `list()` with several leagues, never per league (`verify(times(1))`, `verifyNoMoreInteractions` on the per-league lookups); `now` read once and the same instant passed through. `create`/`update`/`deactivate`/`reactivate` leave the six fields null. `ServerClock.now()` trivial test |
| Integration (backend, Testcontainers, `AbstractIntegrationTest`) | `MatchRepository.summariseByLeagueForSeason`: counts only active matches of the stated club, season and league (excludes inactive, other season, other league, other club, no-league); `playedCount` counts only `matchDate < now`; a match **exactly at** `now` is to-go and is the next match; `firstMatchDate`/`lastMatchDate`/`nextMatchDate` are the right min/max/earliest-future, including all-past (next null) and all-future (played 0) and a single match (first equals last); grouped per league in one call. `LeagueAffiliationRepository.findTeamSummariesBySeasonId`: only the stated season, name-sorted, projects name/abbreviation/logo, a team affiliated to two leagues appears under each. `LeagueTeamRepository.findActiveBySeasonId`: only active rows of the season, name-sorted. **N+1 guard:** a service-tier test (no ambient test transaction, per `docs/standards/backend.md`) using Hibernate statistics asserts the prepared-statement count of `list()` is identical for a club with 1 league and a club with 12 leagues. `LeagueControllerIntegrationTest`: `GET .../leagues` through real HTTP returns the new fields for a club with matches, affiliations and league teams, and the empty shape for a club with none; another club's admin cannot read them (existing 403/404 behaviour) |
| Contract | `openapi.yaml`: six `LeagueDto` properties and `LeagueSeasonTeamDto` added, additions only |
| Component (Vitest/RTL) | `LeagueCard`: title wraps; badges in order and tone (format only when set, "N teams"/"1 team" from `teams.length`, season label only when present, Active vs Inactive); the avatar uses the logo with the trophy fallback; First match with a date and with "Not scheduled yet"; Next match with date-time and the green badge reading "in N days", "tomorrow" and "today", and "None scheduled"; **Last match** after Next match with a date, with the same date as First for a single match, and "Not scheduled yet" when none; Playing XI "N players" always; Age range shown only when a bound is set (both bounds, one bound with "Any"); progress block "N of M", bar value, "N played · K to go", and the M = 0 case ("0 of 0", "No matches scheduled yet"), null counts as 0; team avatars: own then league order preserved, logo vs abbreviation vs initials fallback, no cap with 20 teams, empty "No teams registered for this season"; social row: website icon first then socials, omitted when none, links clickable and not swallowed by the card link (clicking one does not navigate); footer: four buttons in order (Schedule, Teams, Conditions, Edit), each navigates to its route, Conditions always enabled, no "Playing Conditions" PDF action, card click opens `.../schedule`. `LeagueList`: grid uses the shared `cardGridSx`; Format filter lists "All formats" plus every format, filters client-side, combines with search, persists per club and survives remount, corrupt storage falls back to default; sort toggle unchanged; empty states. Shared extractions: `DetailLine` (default width unchanged, `labelWidth`, `muted`, ReactNode value), `CardProgressBar`, `SocialLinksRow` website icon, `resolveCountdownLabel` (today, tomorrow, days; local midnight boundaries) with `resolveNextMatchCountdown` tests unchanged, `formatMatchDate`; existing `MatchCard`, `SelectionBlock` and `SquadPicker` tests pass untouched |
| Browser check | Phone (375px), two-column and wide: one column on a phone with the footer never clipped, cards in a row equal height with footers aligned, a league with many teams wraps its avatars and grows without breaking the row, social icons clickable, card click and each footer button land on the right view |
| End-to-end | None new (extends the existing, not-in-CI league flow) |

## Acceptance Criteria

- A league card is built like a match card: badges above a wrapping title, stacked detail lines, a progress block, a team avatars row, optional social icons and a four-button icon-over-caption footer; cards in a row are equal height with the footer pinned.
- The badges are colour-coded: format purple, team count blue, current season amber, Active green or Inactive grey.
- The card shows First match, Next match (with "in N days", "today" or "tomorrow"), Last match, Playing XI and, when set, Age range, with the stated placeholders when nothing is scheduled.
- "Matches played N of M" counts active matches of the current season whose date has passed by the server clock; with none scheduled it reads "No matches scheduled yet". No result or completed status is introduced.
- The avatars row lists every team of the current season, the club's own first (solid green) then the active league teams, each with its abbreviation, with no cap and no "+N"; empty reads "No teams registered for this season".
- Website and social links appear as icons (website first) above the card link and open without opening the league; the row is absent when there are none.
- Schedule, Teams and Conditions open the matching `072` view, Edit opens the edit screen, Conditions is always enabled, clicking the card opens the Schedule, and the old Playing Conditions PDF shortcut is gone.
- The list uses the shared card grid, offers a Format filter (including "All formats") beside search and sort, and remembers the format per club.
- The leagues list response carries the new aggregates for the current season with a query count that does not grow with the number of leagues; the other league endpoints are unchanged apart from the new fields being null.
- On a phone the card is one column and the footer is never clipped.

## Rollout Notes

- **Build order: `072` first, then `071`.** The footer buttons and the card click link to routes that only exist once `072` ships, and `071` reuses `072`'s `leagueBadges` helper and badge tones. Within `071`: backend first (the additive `LeagueDto` fields, the three batch queries, `openapi.yaml`; safe to ship alone because the old card ignores unknown fields), then the frontend. Frontend can mock the new fields until the backend lands.
- **No migration, no feature flag.** The new fields are computed.
- **Conflict check against drafts.** `055` (not built, not touched) would remove `maxPlayingXiSize`/`minAge`/`maxAge`/`ageCutoffDate` from `LeagueDto`/`League` and, in its UI section, remove the "Playing XI size"/"Age range" fields from the league card; `071` deliberately keeps both lines, so whichever of the two lands second must reconcile: `055`'s card change becomes "the Playing XI and Age range lines read from the current season's `LeaguePlayingConditions`" rather than "are removed" (its own `LeagueDto` field removals then also need the card's data source added to this spec's batched path, one more existing batch, `LeaguePlayingConditionsRepository.findBySeasonId`, already used by `list()`). `058` (captain auto-select, `MatchFormPage`) is unrelated. `062` is superseded in part by `072`, not by this spec. `070` is consumed as built (no change to it).
- **Shared extractions touch `069` code** (`DetailLine`, `CardProgressBar`): behaviour-preserving, covered by the existing Match card tests.
- **`docs/roadmap.md`** (living index; update in the build PR, not by this spec). Add: (1) **a true completed/results status for matches**, deferred to the future match-results spec, at which point the card's "played" and progress should read it instead of the date rule; (2) **match naming** (for example "Final"), with a note that the card's Last match line should show the name beside the date once matches can be named; (3) when draft `055` is built, the card's Playing XI and Age range lines read from `LeaguePlayingConditions`; (4) retire `LeagueDto.currentSeasonTeamCount` and `currentSeasonPlayingConditionsUrl` once nothing reads them (the card no longer does); (5) the inactive-card dimming from the mockup, if wanted, would be a small `RecordCard` option.
- **`docs/standards/design-system.md`:** nothing new beyond `072`'s token and tone notes; the `DetailLine` and `CardProgressBar` extractions get their component-library entries with their stories.
- **Decisions recorded (user, resolved):** Playing XI and Age range stay on the card; "played" is date-based with no status field; the avatars row has no cap and wraps; the card click opens the Schedule; the Format filter is client-side and persisted; **Last match** is a date-only line (no naming yet).
