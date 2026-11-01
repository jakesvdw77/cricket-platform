# 135: Player Hub Match View

**Depends on:** `121-player-hub-menu-and-fields.md` (Hub menu, `hubNav.ts`, `hubBack`, footer Back, phone rules, `MyPlayerAccess`), `123-player-hub-leagues.md` (league page, `MyLeagueFixtureDto` rows, `MyLeagueServiceImpl`, "Your game" highlight; its Non-goals and follow-ups name this view as future work), `124` (league specs follow-up, Hub league rows), `133-field-location-and-directions.md` (`HubFixtureLocation`, `useMatchWeather`, `GetDirectionsButton`), `129`-`134` and `docs/standards/page-anatomy.md` (manager Matches round), `040-announce-team.md` (`MatchSide.announced`; its Non-goals say the flag exists to gate exactly this player-facing view), `076-team-selection.md` (selection, release), `034`/`064`-`066` (availability polls, poll screens), `119` (`/api/v1/me/players`, `PollAnswer` save), `122-league-sharing.md`/`114` (junior initials via `shareName`), `docs/standards/*.md`.
**Status:** draft (owner decisions of 2026-11-01 recorded below; open questions have defaults). No code is written by this spec.

## Problem & Goals

The manager Matches pages were revamped to `page-anatomy.md` (`130`-`134`), but a parent, player or agent in the Player Hub still has no page for one match. The only match rows in the Hub are league fixtures (`HubLeagueSchedule`, `HubLeagueResults`) with no tap target: weather and Get Directions (`133`) are on the row, but "who is selected", "when do I need to answer" and "where do I go" are not. `schedule.matches` in `hubNav.ts` is still a Soon item, and `123` explicitly left fixture detail pages out.

Goals:

- **A. A player-facing match page** in the Hub for one match of a linked player's team.
- **B. Hub fixture rows consistent with the manager lists** (one tap target, no chevron, same label rules) and opening that page.
- **C. Privacy by construction**: initials for juniors, the XI only after the manager announced it, no manager-only data.
- **D. One scoped backend read**, authorised by the account's link to the player.

## Non-goals

- **Sharing from the player view** (owner, 2026-11-01). No Share button, no Share Match dialog, no team-sheet share. Revisit only on request.
- **Editing selection**, announcing or releasing, availability management, or any manager action. Read-only except the existing availability answer, which is saved by the existing poll flow (`119`), not by this page.
- **Live scoring, scorecards, player performances or result detail.** A played match shows the published result line only (`123` Decision 4); scorecards belong to Stats.
- **Other players' availability**: no responses, counts, or "who has not answered".
- **Manager-only data**: internal notes, poll configuration, squad membership of others, contacts, active flags, import data.
- **Training sessions and non-match events** (the Soon copy of `schedule.matches` mentions training; not here).
- **The Matches list, Results and Team sheets Hub items.** This spec builds the one match page and the way into it from league rows; a Schedule > Matches list is a follow-up (Open question 4).
- **Per-club time zones** (known gap).

## User Stories

- As a parent, I tap a fixture row and see when, where, who plays, and whether my player is selected, so I know what to bring and when to arrive.
- As a parent, I see "Not announced yet" until the manager announces the team, so I am never told a team that is still being changed.
- As a parent, I see my player's availability answer for this match and, while the poll is open, a link to change it.
- As a parent, I see the forecast and tap Get Directions from the match page.
- As a parent of a junior team, I see other juniors as initials only.
- As an agent, I see only matches of players I am linked to.

## Data Model Changes

None. No migration, no new column, no club switch. `MatchSide.announced` (`040`) already exists and is the gate.

## API Contract

**Finding (flagged, not assumed):** a new read is required. `MyLeagueFixtureDto` (`123`, extended by `133`) carries no sides' players, no selection state, no availability answer, and `MyPoll` lists open polls only with no match id. The league page's `matchId` is "opaque, list key only" (`123`) and no endpoint accepts it. Also, the brief names `MyScheduleItemDto`; no such type exists in `backend/` or `ui/src` today, so the fields spec `133` added live on `MyLeagueFixtureDto` (`playingAreaId`, `playingAreaName`, coordinates, access point and note). This spec reuses those, not an invented type.

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/me/players/{playerKey}/matches/{matchId}` | Authenticated; authorised only through `MyPlayerAccess.resolve`. Key not held, malformed key, dropped-out player: **404**; SUSPENDED: **403**. A `matchId` that is not a match of one of the held player's teams (squad row for the match's season, home or away by `team_id`, or the league team that maps to it), or is another club's, is **404**, never 403 or an empty body | One match as `MyMatchDto` |

Added to `MePlayersController` (thin, delegating to a new `MyMatchService` interface and impl, `@Transactional(readOnly = true)`, same shape as `MyLeagueService`). It reuses the existing match, match side, poll answer and published result read logic through internal read methods (as `123` does), maps to `My*` DTOs, and does not call or widen manager controllers or DTOs. `openapi.yaml` is regenerated by hand (no `mvn` under the live backend). The caller supplies no club.

**`MyMatchDto`** (response only; a test asserts the exact JSON keys)

| Property | Type | Notes |
|---|---|---|
| `matchId`, `date`, `time` | uuid, yyyy-MM-dd, HH:mm or null | |
| `status` | `UPCOMING`, `PLAYED`, `CANCELLED`, `POSTPONED` | Derived as the manager badge derives it (`130`) |
| `league` | `{ id, name }` or null | |
| `season` | `{ id, name }` | |
| `venue`, `playingAreaId`, `playingAreaName`, coordinates, access point and note | as `MyLeagueFixtureDto` (`133`) | Feeds `fieldFromMatch`, `useMatchWeather`, `directionsTarget` unchanged |
| `home`, `away` | `{ name, logoUrl, mine, announced, players[] }` | `players` is **empty unless that side `announced` is true** (see below); each `{ name, role, captain, keeper }`, with `name` already reduced to initials for juniors by the server |
| `myTeamSide` | `HOME`, `AWAY` | The side that is the held player's team |
| `selection` | `SELECTED`, `NOT_SELECTED`, `NOT_ANNOUNCED` | Server-computed for the held player: `NOT_ANNOUNCED` while the player's own side is not announced; otherwise by membership of the announced XI |
| `availability` | `{ answer, pollId, pollOpen }` or null | `answer` is the held player's own answer for this match (`YES`, `NO`, `MAYBE`, or null for not answered); `pollOpen` true only while the poll accepts answers; null when no poll covers the match |
| `result` | `{ homeScore, awayScore, resultLine }` or null | Published only; as `MyLeagueResultDto` |

**Deliberately absent:** others' poll responses and availability counts, internal notes, draft or unpublished results, contacts, active flags, squad lists beyond the announced XI, creator and audit fields, import data.

**Privacy rules (server side).** A side's `players` are filled only when `announced` is true (default, Open question 1). Juniors (held player or listed player under 18, or a match in a league with `maxAge` at or below 18, per `122`) appear as initials through the same rule as `shareName` (`114`); the server applies it, so the client never receives a junior's full name. The held player's own name is not repeated (the page already knows it from the Hub selector).

## UI Requirements

Composed from `HubFrame`, `hubStyle.ts` (`HUB`, `hubHeading`, `darkFieldSx`), `HubFixtureLocation` (reused as is: weather badge and Get Directions), `LeagueLogo`, `leagueFormat.ts` date helpers, `LinkedPollCard`'s answer wording, the compact `Button`, and `BrandIcon`. Dark console only, no new hex literals (`120` gate). Hub-local components: `HubMatch.tsx` (page), `HubMatchFigures.tsx`, `HubMatchSide.tsx`. No new shared component.

### 1. Page (`HubMatch.tsx`)

Route `/account/players/:key/schedule/matches/:matchId`, with `?league=` and `?season=` carried so Back returns to the league tab it came from. `hubBack` gains this state: **"Back to {league name} schedule"** (or "Back to Leagues" when the league is unknown), the footer Back being the one Back (`121`/`123`: no header Back). `schedule.matches` stays Soon until Open question 4 is answered; the page is reached from league rows only.

Top to bottom (the manager Match page skeleton of `page-anatomy.md` section 1, adapted):

1. **Title row:** team logos, "Home versus Away" in the display face, and **one** status badge inline (Upcoming, Played, Cancelled, Postponed). No Manage menu, no Season pill action row; the season sits in the League and Season figure.
2. **Figures:** static compact counters (no icons, not clickable, 44 px tall on touch) in one wrapping row: **When** (date and time, with a countdown such as "in 3 days" for an upcoming match, "today" on the day), **Where** (field name or venue; the text is not a link, Get Directions below does the job), **League and Season** (league name, season name; "Friendly" with no league), **Your Status** (Selected, Not Selected, Not Announced Yet, or "Played" once a result exists).
3. **Location row** (one row, under the figures): the forecast badge and Get Directions, both from `HubFixtureLocation`, shown only for an upcoming match and only when they resolve (`133` rules, including "(approximate)").
4. **Your Availability panel:** the held player's answer in words and, when `pollOpen`, an outlined "Answer Availability" button opening the existing Hub poll answering (`MyPlayerPolls` / `LinkedPollCard` path for that `pollId`); a closed poll shows the answer with "Poll closed". No panel when `availability` is null.
5. **Teams:** two flat hairline panels (home, away), the player's own side marked with the text tag "Your team". Each lists the announced XI (initials for juniors, "(C)" and "(WK)" tags, text not colour alone) or the line "Team not announced yet" when not announced. The player's own row is not highlighted by name; the Your Status counter carries it.
6. **Result** (played only): a flat panel with scores and the result line, no scorecard link.

States: loading skeleton per band; 404 shows "This match is not available" with the footer Back; error shows the retry line. Empty XI is not an error.

### 2. Hub fixture rows (`HubLeagueGames.tsx`)

- **Schedule rows** (the Hub counterpart of the manager's table rows, `page-anatomy.md` section 6): the whole row is one tap target (stretched link, 44 px minimum, hover tint and pointer, focus ring in gold) opening the match page for **every fixture of the player's own teams** (`mine`). A row that is not `mine` opens nothing, because the data rule above limits the read to the player's teams; it stays a plain row with no tap cue (so no dead link is drawn). **No chevron, no kebab**: the Hub has no row actions (no Edit, Share or Add), and a kebab with one item would be a lone control; Get Directions stays its own button inside the row, outside the stretched link, as `133` built it.
- **Results rows** follow the same rule for `mine` rows.
- **Labels:** Title Case for buttons and tags ("Your Game", "Get Directions", "Answer Availability"); body text and headings stay sentence case; `-` for a missing value; no count text and no counts in toggle labels; "Only my games" stays as the existing switch (a toggle chip is the manager rule for filter bars, this is the Hub's own list control, see below).
- **Flat panels:** rows and panels are flat with a hairline (the existing `HUB.line` border), no shadow, consistent with `page-anatomy.md` section 4.

### 3. Where the Hub differs from the manager standard, and why

The Hub is a dark console with a footer Back (`121`), so: no top-row Back, no filled Manage menu (nothing to manage), no kebab (no actions), no Season pill (one season in context), the status badge and the figure counters are drawn in `HUB` tokens not the manager light theme, and the "Only my games" switch keeps its existing Hub form. These are Hub rules, not forgotten standards. The shared rules that do carry over are: flat hairline surfaces, compact static counters without icons, Title Case labels, no chevron, one tap target per row, 44 px touch targets, no lone control rows.

### 4. API client

`myPlayersApi.ts` gains `MyMatchDto` and `useMyPlayerMatch(playerKey, matchId)` (key `[...myPlayersKey, key, 'match', matchId]`, `retry: false`); no axios in components. After a poll answer is saved the match query is invalidated so the availability line updates.

### 5. Docs updated in the same change set

`docs/standards/page-anatomy.md` (a short "Player Hub differences" note and the review log row), `docs/standards/design-system.md` only if a component changes, `docs/roadmap.md` (the `123` follow-up "a league fixture opening the match page" resolved; Matches list, Team sheets and Results Hub items remain), and `docs/specs/040-announce-team.md`'s Rollout Notes pointer ("player-facing half of Announce now consumed by `135`").

## Test Plan

Per `docs/standards/testing.md`; tests are written after the owner has checked the function.

- **Unit (JUnit 5):** `MyMatchServiceImpl`: 404 for a match of another team, another club, or an unknown id; `selection` is `NOT_ANNOUNCED` when the own side is unannounced, `SELECTED` or `NOT_SELECTED` once announced; `players` empty for an unannounced side; junior names are initials, adult names full; the answer is the held player's own only; `pollOpen` false once closed; result only when published; un-announcing again (`040`) empties the XI.
- **Integration (Testcontainers):** authorisation matrix (key not held, malformed, dropped-out, another account's key, manager role without link: 404; unauthenticated 401; SUSPENDED 403); no manager-only keys (exact JSON key assertion, no counts, no other players' answers); a parent with players at two clubs gets each club's data and no cross-club match.
- **Contract:** hand-regenerated `openapi.yaml` diff, one path and its schemas, additions only; ArchUnit layering passes.
- **Unit (Vitest):** `hubBack` match states; `selectionLabel` and countdown helpers; row rules (`mine` rows are links, others are not).
- **Component and Storybook:** page for each status and each selection state, the not-announced line, the answer panel with an open and a closed poll, weather and directions present and absent, junior initials as given, no Share, no Manage menu, no Edit, exactly one Back (footer). Fixture rows: one tap target, no chevron, Get Directions still operable. Stories at 375, 768, 1280.
- **E2E (Playwright):** parent signs in, Schedule, Leagues, opens a league, taps "Your game", sees the match page, answers availability from the link, sees the status.
- **Manual:** the three sweeps, keyboard pass, a two-club parent, a junior team with initials.

## Acceptance Criteria

1. A `mine` fixture row in the Hub league Schedule and Results opens the match page by tapping anywhere on the row except Get Directions; the row has no chevron and no kebab; a non-`mine` row has no tap cue.
2. The match page has the title with one status badge, four static compact figures (When with countdown, Where, League and Season, Your Status), the forecast badge and Get Directions when they resolve, both teams, and the availability panel.
3. Your Status reads Not Announced Yet while the player's side is not announced, then Selected or Not Selected.
4. No XI is returned or drawn for an unannounced side.
5. Juniors appear as initials only, applied server side.
6. The page never shows other players' availability, counts, notes or any manager-only data; a test asserts the exact JSON keys.
7. The endpoint answers 404 for a match outside the held player's teams or club, 403 for a suspended account, 401 unauthenticated.
8. There is no Share, Edit, Manage or live scoring control anywhere on the page, and the footer Back is the only Back.
9. Nothing is saved from this page; the answer link uses the existing poll flow and the page shows the new answer afterwards.
10. No new table or migration; "children" appears nowhere.

## Rollout Notes

- **Order:** backend read (service, DTO, controller method, `openapi.yaml`), API client, page, row changes, docs. One PR. No feature flag and no club switch.
- Depends on `040`'s flag being reliably cleared on any XI edit (already built), so un-announcing hides the XI at once.
- Follow-ups: Schedule > Matches list (turns `schedule.matches` live), Results and Team sheets Hub items reusing this DTO, sharing from the player view if the owner asks, a club hide switch if clubs ask.

## Documentation gaps

- `docs/standards/page-anatomy.md` states no rule for Hub (dark console) pages; section 3 above is the working interpretation and should be recorded there once the owner agrees.
- No existing spec defines which polls cover a match for the "answer" lookup (squad poll versus group poll, `034`). Default: the held player's answer on the squad poll of the match's team, else the group poll that includes the match; implementer confirms against `PollAnswer` before building.

## Open questions (defaults apply unless the owner says otherwise)

1. **When is the XI visible?** Default: only after the manager announced that side (`040`). Alternative: show the selected XI as soon as it exists. Unannounced-by-default protects players from a team that is still changing.
2. **Show the opposing side's XI?** Default: yes, once announced (it is on the shared team sheet anyway). Alternative: own side only.
3. **Non-`mine` league rows open a match page?** Default: no (privacy and the scoped read). Alternative: a reduced page with date, place and result only.
4. **Make Schedule > Matches live now with a list of the player's upcoming matches?** Default: no, a follow-up; this spec only adds the page and the way in from league rows.
5. **Show "Selected" for a player on the twelfth-man line?** Default: yes, labelled "Selected (12th)".
