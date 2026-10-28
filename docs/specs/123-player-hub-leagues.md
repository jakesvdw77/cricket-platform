# 123: Player Hub Leagues

**Depends on:** `121-player-hub-menu-and-fields.md` (the Player Hub menu, `hubNav.ts`, `hubBack`, the Soon item `schedule.leagues`, phone rules, Field Directory as the pattern for a read-only `/me` screen), `122-league-sharing.md` (`ShareLeagueDialog`, `LeagueShareModel`, per-club disabled formats, contact and junior privacy; its Non-goals and Rollout Notes name this spec as group D), `119-login-account-journey.md` (linked accounts, `MyPlayerAccess`, `/api/v1/me/players`), `029-league-management.md` and `070-league-teams.md` (leagues, `LeagueAffiliation`, `LeagueTeam`, `TeamSquadMember`), `091-leagues-gold-standard.md` and `095-league-edit-gold-standard.md` (the manager league page and tabs this mirrors read-only), `094-club-structure-and-seasons.md` (seasons, current season), `100-match-results-core.md` (published results), `111-league-season-dates.md` (key dates), `064`-`066` (the poll screens, the look to mirror), `docs/standards/*.md`.
**Status:** approved (2026-10-28). The decisions in "Decisions" below were made by the owner and are not reopened. Part of the leagues completion work. No code is written by this spec.

## Problem & Goals

In the Player Hub, Schedule > Leagues is a locked Soon item (`121`). A parent, a player or an agent cannot see which leagues the selected player's teams play in, who else is in them, the playing conditions, or the whole fixture list, and has to ask the club. The manager league endpoints cannot be used for this: they are club-manager scoped and carry manager-only fields. `122` deliberately left the player-scoped read and the Hub screen to this spec.

Goals:

- **A. Make Schedule > Leagues live** for the selected linked player, with a season switcher (current season by default).
- **B. A read-only league page** with tabs Details, Playing conditions, Teams, Schedule, Results and Key dates.
- **C. One player-scoped backend read** under `/api/v1/me/players/{playerKey}/...`, authorised only by the account's link to that player, reusing the existing league read services and exposing no manager-only data.
- **D. Share** from the page through the `122` dialog, with its privacy defaults.
- **E. A phone experience** that follows the Player Hub phone rules and the poll-screen look.

## Non-goals

- **Standings and points tables.** The league has no points table read (`122`); out of scope here too.
- **Any editing.** No league, team, fixture or result can be changed from the Hub. Read-only throughout.
- **Player performances, scorecards and statistics.** Results show scores and the result line only (`122` Decision 3). Player stats belong to Stats (`103`, `116`).
- **Other clubs' leagues, a platform-wide league directory, or leagues of players the account does not hold.** Club and player scoped through `MyPlayerAccess` only.
- **Manager-only fields.** Contact phone and email, internal notes, active and inactive flags on teams, affiliation ids, creator ids, draft results, unpublished anything, import data.
- **Fixture detail pages, team sheets, availability or match-day actions** from a league fixture (Schedule > Matches, Team sheets and Availability are their own items).
- **A public or shareable link.** Sharing is the `122` dialog output only.
- **New tables, new club switches or new roles.** A link still never grants a `RoleAssignment` (`119`).
- **A change to the manager shell, the manager league screens or any `/api/v1/manage` endpoint.**
- **Per-club time zones** (known gap, unchanged).

## Decisions

Owner decisions, binding:

1. Schedule > Leagues (`schedule.leagues`) stops being a Soon item.
2. The page lists the leagues the **selected** linked player's teams play in. Current season by default, with a season switcher. Switching players re-fetches.
3. Each league opens a **read-only league page** with tabs **Details, Playing conditions, Teams, Schedule, Results, Key dates**. League information is shown for every league the player plays in.
4. **Schedule** shows the **whole league schedule**, with the player's team games highlighted. **Results** shows published results only, with scores and result lines.
5. A **Share** button reuses the `ShareLeagueDialog` of `122`: formats and the per-club disabled formats honoured, no contacts (managers only), junior names as initials.
6. New backend: player-scoped read endpoints under `/me/players/{key}/...`, authorised by the account's link to that player only. Existing league read services are reused. No new tables.
7. Mobile follows the Player Hub phone rules: the footer Back is the one Back, a pill row for the tabs, 44 px touch targets. Compact buttons. Mirror the poll screens.
8. Empty state: brand icon plus "No league available".
9. Wording: players are never called "children"; UK spelling; no em dashes.

## User Stories

- As a parent, I open Schedule, then Leagues, and see the leagues my selected player's teams play in this season, so I know where they compete.
- As a parent, I switch season and see the leagues the player's teams played in then.
- As a parent with players at two clubs, I see Riverside's leagues when Anna is selected and Hillside's when Tom is selected.
- As a parent, I open a league and read its details, playing conditions, teams, key dates, so I do not have to ask the club.
- As a parent, I see the whole league schedule with my player's team games highlighted, so I find our games without scanning every fixture.
- As a parent, I see published results with scores and result lines, so I know how the league is going.
- As a player, I do the same for my own record.
- As an agent, I see only the leagues of the players I am linked to, never another player's or another club's.
- As a parent, I tap Share and send the league's schedule or key dates to another parent, in a format my club allows, with no phone numbers or junior full names leaving by accident.
- As a parent on a phone, I move one screen at a time, the one Back at the bottom says where it goes, and every control is easy to hit.
- As a parent whose player's team is in no league, I see "No league available" instead of an empty screen.

## Data Model Changes

None. No migration, no new column, no club switch. The reads join existing rows:

- The player's teams for a season: `TeamSquadMember` (`team_id`, `season_id`, `player_profile_id`) for the held player's profile.
- The leagues those teams play in: `LeagueAffiliation` (`league_id`, `team_id`, `season_id`).
- League data: `League`, `LeagueSeason`, `LeagueTeam`, `LeaguePlayingConditions`, `Match` (`league_id`, `home_league_team_id`, `away_league_team_id`, `home_team_id`, `away_team_id`), published results (`100`), season dates (`111`).

`openapi.yaml` gains the paths and schemas below, regenerated by hand (no `mvn` under the live backend).

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/me/players/{playerKey}/leagues?seasonId=` | Authenticated; authorised only through `MyPlayerAccess.resolve`. A key the caller does not hold, a malformed key and a dropped-out player are **404**, never 403; a SUSPENDED caller is 403 | The leagues the held player's teams play in for the season, plus the seasons offered, as `MyLeaguesDto` |
| `GET /api/v1/me/players/{playerKey}/leagues/{leagueId}?seasonId=` | Same | One league as `MyLeagueDto`: details, playing conditions, teams, whole schedule, published results, key dates |

No other endpoint is added or changed. Both are added to `MePlayersController` (thin, delegating to a new `MyLeagueService` interface and impl, `@Transactional(readOnly = true)`, in the shape of `MyFieldService`).

**Rules (server side).**

- The club is the resolved held player's `clubId`. The caller supplies no club.
- `seasonId` is optional. Omitted means the club's current season (`094`). A season that is not one of that club's seasons is a 404.
- A league is listed only when at least one team in which the held player has a squad row for that season is affiliated to it for that season. In the detail call, a `leagueId` that does not satisfy this for the player and season is **404** (not 403, not an empty body), so a valid league id from another player's team or another club reveals nothing.
- Inactive leagues are excluded (Open question 1).
- The "player's teams" are computed from the held player's own profile only. The caller can never ask for another player's teams.
- Reuse: the service calls the existing league, league team, affiliation, playing conditions, season dates and published results read logic (the same queries behind `LeagueService`, `LeagueTeamService`, `LeaguePlayingConditionsService`, `LeagueSeasonDatesService` and `ResultService`) through internal read methods or shared read helpers, mapped to the `My*` DTOs. It does not call the manager controllers and does not widen their DTOs. If an existing service method is club-scoped by `clubId` only, it is called with the held player's `clubId` and the league and season ids already proven by the rule above.
- Schedule rows are all active matches of the league and season (past and future, not cancelled hidden by the manager rules of `050`), ordered by date and time. Each carries `mine = true` when either side is one of the held player's teams (by `team_id`, or by the league team that maps to it).
- Results are matches of the league and season whose result is **published** only. Drafts, unpublished and imports in progress never appear.
- Error handling follows `docs/standards/backend.md`: `NotFoundException` from `MyPlayerAccess` or the league rule; no new exception type.

**`MyLeaguesDto`** (response only)

| Property | Type | Notes |
|---|---|---|
| `seasons` | list of `{ id, name, current }` | The seasons in which any of the held player's teams are affiliated to a league, newest first, always including the selected one; drives the switcher |
| `seasonId` | uuid | The season the list is for |
| `leagues` | list of `MyLeagueSummaryDto` | Name order, case-insensitive |

**`MyLeagueSummaryDto`:** `id`, `name`, `logoUrl` (nullable), `minAge`, `maxAge` (nullable), `teamCount`, `myTeams` (list of `{ id, name }` for the player's teams in this league), `nextMatchDate` (nullable), `matchCount`.

**`MyLeagueDto`** (response only; the server-side twin of `LeagueShareModel` from `122`, so field names match and the same assembler can feed the Share dialog with no second shape)

| Property | Type | Notes |
|---|---|---|
| `league` | `{ id, name, description, logoUrl, minAge, maxAge, ageCutoffDay, ageCutoffMonth, format, website, socialLinks[] }` | No `contacts` at all: league contacts are for managers (Decision 3). Fields that are manager-only on `LeagueDto` (active flag, created and updated audit fields, internal notes) are absent |
| `season` | `{ id, name, startDate, endDate }` | |
| `playingConditions` | object or null | The season's structured conditions and the link to the PDF if one exists, as the Conditions tab reads them; null when none are set |
| `teams` | list of `{ id, name, abbreviation, logoUrl, mine }` | Active league teams of the season, name order; `mine` marks the player's teams. No affiliation ids, no inactive rows |
| `schedule` | list of `{ matchId, date, time, homeName, homeLogoUrl, awayName, awayLogoUrl, venue, mine }` | The whole league schedule. `matchId` is opaque and used only as a list key; no fixture link target exists in the Hub |
| `results` | list of `{ matchId, date, homeName, awayName, homeScore, awayScore, resultLine, mine }` | Published only; scores as short text (for example "142/6 (20.0)"); the result line as `100` produces it |
| `keyDates` | `{ seasonStart, seasonEnd, firstMatchDate, lastMatchDate, nextMatchDate }` | Each nullable |

**Deliberately absent (manager-only or internal):** draft or unpublished result data, scorecards and player performances, active and inactive flags, affiliation ids, `createdBy` and audit fields, contact phone and email, notes, import data, other clubs' data. A test asserts the exact JSON keys of each DTO.

**Share.** The page builds a `LeagueShareModel` from `MyLeagueDto` (a thin client mapper in `shareLeagueData.ts`, owned by `122`, extended with a second input source rather than a forked model). The `122` privacy rules apply on top: the Hub never has contacts, so the Contacts content and the phone and email opt-in are **not offered** in the Hub share; junior names are initials through `shareName`. A league with `maxAge` at or below 18 is junior for the whole share (`122`).

## UI Requirements

Composed from `HubFrame`, `hubStyle.ts` (`HUB`, `hubHeading`, `hubOutlineButton`, `darkFieldSx`), `brandTokens.ts`, `HubSoonPanel` (no longer used for this item), the poll screen components for the look (`PollCard`, `SlotSummary` pattern, `064`-`066`), the compact `Button`, the brand icon via `components/BrandIcon`, and `ShareLeagueDialog` (`122`). Dark console only. No new hex literals (`120` grep gate). No new shared component is expected beyond Hub-local ones.

### 1. Menu and routes

- In `hubNav.ts`, `schedule.leagues` loses `soon` and `soonCopy`. No new item, no change to the six top-level limit or to the label table of `121`. The label stays "Leagues".
- Routes follow the `121` shape: `/account/players/:key/schedule/leagues` shows the list; `/account/players/:key/schedule/leagues/:leagueId` shows a league; the tab is a query parameter `?tab=details|conditions|teams|schedule|results|dates` (default `details`); `?season=` carries the season. State is the URL so refresh and the browser Back agree with the footer Back.
- `hubBack` gains the league page states (see section 4); the table in `121` is otherwise unchanged. There is still exactly one Back, in the footer.

### 2. Leagues list (`HubLeagues.tsx`, new)

- Heading "Leagues". Under it, the season switcher (a compact select, 44 px, `darkFieldSx`), defaulting to the current season; only the seasons the API returns.
- One **league card** per league, in the poll-card look: logo or brand icon, league name (condensed uppercase), the age band ("Under 15" style from `minAge` and `maxAge`, as `091` words it), "N teams", the player's team name or names ("Riverside U15 A"), next match date when set. The whole card is the button (44 px minimum, focus ring) and opens the league page.
- States: loading (skeleton cards), error ("We could not load the leagues. Please try again." with retry), **empty: the brand icon plus "No league available"** (also for a season with none), no list chrome.
- Switching players or season re-fetches (keys include the player key and season).

### 3. League page (`HubLeague.tsx` and one component per tab, new)

- Header: league logo or brand icon, league name, season pill, the player's team chips, a compact **Share** button on the right. The Share button opens `ShareLeagueDialog` with the `MyLeagueDto`-based model, preselecting the current tab's content (Schedule from Schedule, Playing conditions from that tab, Teams from Teams, Results from Results, Key dates from Key dates, League details from Details). It is hidden if the club has disabled every format for leagues (the dialog's own "no format" message does not appear here, because the entry would be dead); formats the club disabled are not offered, as in `122`.
- **Tabs.** Wide layouts: a tab bar. Phone: a **pill row** (scrolls horizontally, selected pill filled gold, 44 px high pills, `role="tablist"` with arrow key support, `aria-selected`). Tabs, in order: **Details, Playing conditions, Teams, Schedule, Results, Key dates**. A tab with nothing to show stays visible and shows its own empty line (below), never hides.
- **Details:** description, age band, format, website and social links as buttons. No contacts (manager-only). Fields that are empty are hidden.
- **Playing conditions:** the season's structured conditions as fact tiles, and an "Open PDF" outlined button when a conditions PDF exists (https only, new tab, `rel="noopener noreferrer"`). Empty: "No playing conditions set for this season yet."
- **Teams:** a card per team with logo and name; the player's team or teams carry a gold "Your team" tag (text, not colour alone). Empty: "No teams entered yet."
- **Schedule:** the **whole** schedule as rows grouped by date: time, home vs away with logos, venue. A row with `mine` has a gold left edge, a gold tinted ground and the text tag "Your game", and a switch **"Only my games"** (off by default, not remembered) filters to them. Past games stay in the list, dimmed slightly, with the date. Empty: "No matches scheduled yet."
- **Results:** published results, newest first, each a card with teams, scores and the result line; `mine` rows tagged "Your game" and a switch "Only my games" as above. Empty: "No results published yet."
- **Key dates:** season start and end, first, last and next match date, as fact tiles with the date in gold. Missing dates are hidden; none at all: "No key dates set for this season yet."
- The page has no Edit, Add, Delete, no manager links and no link into a fixture, a team sheet or availability. A link to nothing is never drawn.
- Loading is a skeleton per tab; an error shows the retry line. Tabs share one query for the league (not one request per tab).

### 4. Footer Back and phone behaviour

- No header Back, no Back row and no Back inside a page (`121` Decision 15).
- Footer labels: on the Leagues list, phone: "Back to Schedule" (the Schedule sub menu); desktop and tablet keep "Back to menu" as for any page in a sub menu. On a league page, phone and tablet and desktop: **"Back to Leagues"**, going to the list for the same season. Escape does the same. Tabs are not history steps beyond the URL parameter; the footer Back from any tab goes to the list.
- Phone: screen 1 menu, screen 2 Schedule sub menu, screen 3 the list, screen 4 the league page (tab pill row at the top, content scrolls above the pinned footer). Touch targets are at least 44 px (cards, pills, switches, Share, links).
- Tablet and desktop: the menu column stays; the list and the league page appear in the content panel.
- Buttons are compact (`docs/standards/design-system.md`), the Share button is outlined, not filled.

### 5. Accessibility

Tabs use `role="tablist"`, `tab` and `tabpanel`; left and right arrows move between tabs; the selected tab has `aria-selected`. Every card is one button with an accessible name (league, season, your team). "Your game" and "Your team" are text. Focus is a 2 px gold outline. Motion under `prefers-reduced-motion`. Contrast as `121`. Sweeps at 375, 768 and 1280 px, no horizontal scroll except the pill row.

### 6. API client and state

`ui/src/api/myPlayersApi.ts` gains `useMyPlayerLeagues(playerKey, seasonId)` (key `['my-players', playerKey, 'leagues', seasonId]`) and `useMyPlayerLeague(playerKey, leagueId, seasonId)`, with the types above. No direct axios in components.

### 7. Docs updated in the same change set

`docs/standards/design-system.md` (the Hub league page and the "Your game" highlight), `docs/standards/frontend.md` (Hub screens read leagues only through `myPlayersApi`), `docs/roadmap.md` (group D done; follow-ups below), `docs/architecture.md` only if it lists Hub sections.

## Test Plan

Per `docs/standards/testing.md`. New endpoints and new UI need unit, integration, contract, component and one E2E. **Tests are written once, at the end of the whole leagues work, after the owner has checked the function**; no per-step tests.

- **Unit (JUnit 5, no Spring):** `MyLeagueServiceImpl` rules: leagues derived from the player's squad rows and affiliations for the season; the `mine` flag by team id and by league team; published-only results; inactive leagues excluded; contacts absent from the DTO; seasons list newest first including the selected one.
- **Unit (Vitest):** `hubNav` (`schedule.leagues` is not Soon; menu still six top-level items, no third level); `hubBack` league states ("Back to Schedule" on a phone list, "Back to Leagues" on a league page, Escape equal to the footer); mapper from `MyLeagueDto` to `LeagueShareModel` (own teams flagged, no contacts, junior initials when `maxAge` is 18 or below); age band wording; "Only my games" filtering.
- **Integration (Testcontainers via `AbstractIntegrationTest`, no ambient class-level `@Transactional`):**
  - List: returns exactly the leagues of the held player's squad teams for the season; a league the player's team is not in never appears; a season switch returns that season's leagues; the default is the current season; another club's league never appears.
  - **Authorisation:** a key the caller does not hold, a malformed key, a dropped-out player and another account's valid key are 404; unauthenticated is 401; SUSPENDED is 403; a caller with a manager `RoleAssignment` but no link gets 404; a league id the player's teams are not in (same club, other club) is 404 on the detail call; an invalid `seasonId` is 404.
  - **No manager-only data:** each response has exactly the documented keys; no contacts, phone or email, no draft results, no inactive teams, no affiliation ids.
  - Detail: whole schedule present with `mine` set correctly for home and away; published results only; key dates and conditions present or null.
  - A parent with players at two clubs gets each club's leagues for each key and no cross-club data.
- **Contract:** the hand-regenerated `openapi.yaml` diff (two paths, schemas) is reviewed, additions only; ArchUnit layering passes (controller to service interface to repository, DTOs at the boundary).
- **Component (Testing Library, mocked API client) and Storybook:** the list (cards, season switch, loading, error, empty with brand icon and "No league available"); the league page (six tabs in order, pill row on a phone, each tab's empty line, "Your game" tags, "Only my games" filter, Share opens the dialog with the tab preselected and honours disabled formats, hidden when no format is left); exactly one Back per screen, in the footer, with the labels above; no Edit, Add or fixture link anywhere; switching player refetches. Stories at 375, 768 and 1280.
- **E2E (Playwright, mobile and desktop):** one golden path: sign in as a parent, Schedule, Leagues, open a league, see the whole schedule with our game highlighted, Share the schedule as Calendar and download the ICS.
- **Manual:** three sweeps, keyboard-only pass, a two-club parent, a player with no league, 200 percent zoom.

## Acceptance Criteria

1. Schedule > Leagues is live and not marked Soon; the menu still has six top-level items.
2. For the selected player and season, the list shows exactly the leagues the player's squad teams are affiliated to, defaulting to the club's current season, with a season switcher limited to seasons that have leagues for the player.
3. Selecting another player re-fetches and shows that player's club and leagues only.
4. A league page has tabs Details, Playing conditions, Teams, Schedule, Results, Key dates, in that order, each with a clear empty line.
5. Schedule shows every league match; the player's team games carry the "Your game" text tag and highlight, and "Only my games" filters them.
6. Results shows published results only, with scores and result lines, and no scorecards or player performances.
7. Share opens the `122` dialog, offers only formats the club has enabled, offers no contacts, and shows junior names as initials.
8. The endpoints are reachable only by an account that holds the player; every other case is 404, a suspended account is 403, and no response contains manager-only data.
9. The league detail call returns 404 for a league the player's teams are not in.
10. An empty list shows the brand icon and "No league available".
11. On a phone the footer Back is the only Back and reads "Back to Schedule" on the list and "Back to Leagues" on a league page; all controls are at least 44 px; the tab row is a pill row.
12. Nothing is editable, no new table or migration exists, and "children" appears nowhere.

## Rollout Notes

- **Order:** backend read (service, DTOs, controller methods, `openapi.yaml`), then the API client and the list screen, then the league page tabs, then Share wiring, then the docs. The `122` dialog and `shareLeagueData.ts` must exist first; this spec is built after `122`.
- **No feature flag and no club switch.** League information is shown to linked accounts for leagues their player plays in (owner Decision 3). A club-level hide is not built; if clubs ask, it is a separate spec (`121` Decision 13).
- **Follow-ups (to `docs/roadmap.md`):** Standings once a points table read exists; a league fixture opening the match page or team sheet when Schedule > Matches ships; a club switch for Hub leagues if asked; showing phone and email for contacts only if a club opts in, in its own spec.

## Decisions (owner, 2026-10-28)

1. Inactive leagues are hidden, including for past seasons.
2. The season switcher offers the seasons in which the player has a league, plus the current season.
3. The Hub shows no league contacts at all (not even role and name); they are for managers. `MyLeagueDto` has no `contacts`, and the Hub share offers no Contacts content.
