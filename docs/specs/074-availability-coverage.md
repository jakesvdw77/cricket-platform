# 074 — Availability Coverage

**Depends on:** `073-availability-hub.md` (the Availability layout route, header and switch this spec adds a third tab and route to; **built first**), `068-player-availability-grid.md` (the `GET …/player-availability` endpoint, its filters, caps and `truncated` flag, and the Players view's filter pattern, all reused as they are), `064-unified-availability-polls.md` and `063-section-availability-and-flexible-squads.md` (squad polls answer per game, group polls answer per date and Morning/Afternoon slot and the answer is repeated on every game of that slot), `069-match-card-redesign.md` (the league's `maxPlayingXiSize` as the playing XI size), `043-list-toolbar-gold-standard.md` and `usePersistedListFilters` (filter persistence), `utils/cardGrid.ts` (the shared card grid), `066`/`069` badge tones (reused for the status badges).
**Status:** approved (design approved by the user). Design: https://claude.ai/artifact/4x7HDVQG893xvcv8rSQJar

## Problem & Goals

A manager running two or three sides on the same Saturday cannot tell from the poll screens or the Players grid whether they have enough **distinct** players. Villagers 1 can show 15 available and Villagers 2 14, but if six of those are the same people, that is not 29 players. The Players grid shows every cell but leaves the arithmetic to the reader, and a poll page only ever shows one poll.

This spec adds a third Availability view, **Coverage**, one card per time slot (a date plus Morning or Afternoon): how many distinct players are available, how many places the club needs to fill, per team how many are available and needed, who is double-booked, and a verdict, **Covered**, **Tight** or **Short by N**. It is frontend only: everything is computed in the browser from data the Players view already loads.

**Goals**
- A **Coverage** tab at `/manage/availability/coverage`, the third view of the `073` hub.
- One card per time slot, including a slot with a single club game, ordered by date ascending, in the shared card grid.
- A pure, unit-tested util that decides each slot's verdict by bipartite matching (players to the places each team needs), so "Tight" and "Short" are computed, not guessed.
- Honest limits: the view says when the data it was given is incomplete (the grid's caps) and never counts "unsure" as available.

## Non-goals

- **A new backend endpoint.** Confirmed expected: none. The grid's response already has, per game, `matchDate`, `dayPart`, `teamId`, `leagueId`, `pollType`, `pollId`, `roundId` and, per player, a cell `{ matchId, status, picked }`. A dedicated endpoint (exact audiences, club-wide counts, uncapped) is a roadmap item (Rollout Notes), not this spec.
- **A Team filter.** Coverage is about comparing teams in a slot; filtering to one team would hide the other team's games and defeat it. Filters are Season, Section and League, plus Show past slots.
- **Derby support.** A match where both sides are the club's own teams appears in the grid with one `teamId` per game (the first own side in scope), so a derby is treated as a game for that one team and its other side is not counted. Two own teams playing each other can never both be short or covered correctly here; fixing it needs the grid response to carry both own teams (roadmap).
- **Player-by-player allocation or rotation advice** ("rest X this week", "pick Y for Villagers 2"). The Tight hint says how many shared players each team must take, never which.
- **Using "picked" players.** Who has already been selected for a match (`picked` on the cell) is ignored; coverage is about availability, not selection. Considering picked players (a player already picked for one team is not free for another) is a roadmap item.
- **Counting unsure answers as available.** Unsure is shown separately and never contributes to a count, a verdict or the matching. It can only be mentioned as a possible way to close a gap.
- **Per-team minimums other than the playing XI** (a squad of 12, reserves, wicket-keeper or bowler mixes). "Needed" is the league's `maxPlayingXiSize`, nothing more.
- **Cross-slot logic.** A player available for the Saturday morning and Saturday afternoon slots counts in both; a game that runs across slots is not modelled.
- **Opening polls or editing answers from a card.** Cards are read-only and not clickable; the Players view and the polls are where answers are read and corrected (`065`, `067`, `068`).
- **Changing the Players view, the polls list or any poll.** Only the switch gains its third tab and the dashboard tile its description.
- **Persisting "Show past slots"**, which resets each visit like the Players view's switches.

## Limits of the data (stated on the page and in the build's tests)

Coverage is exactly as complete as the Players grid response it is computed from (`068`):

- **Filters apply server-side.** Season, Section and League narrow the games and the rows; a narrower Section gives a narrower picture (players tagged to other sections, or other sections' teams, are absent).
- **Caps.** The server returns at most 150 games and 500 players per response. When it cuts either, the response has `truncated: true`; Coverage then shows a notice (below) because slots near the cut, and every count that depends on the missing players, may be understated.
- **Own club's teams only.** A game appears with this club's team in it; opponents' strength is irrelevant and not modelled.
- **Row-candidate players only.** The rows are the players of the chosen section scope (active players) or squad rows the grid builds; a player the grid does not list as a row is invisible to Coverage even if they answered a poll elsewhere.
- **Upcoming games only** unless Show past slots is on (`includePast`); with it on, the server keeps the **latest** 150 games.
- **One team per game** (the derby limit above).
- **Day part and date.** A slot's Morning/Afternoon is the server's `dayPart` for the game; its calendar date is the game's `matchDate` in the browser's local zone (the same local-date grouping the Players grid header uses). The two agree whenever the manager's browser is in the server's zone (as already noted in `066`).
- **Group polls answer for the slot, not the team.** A player who answers Available on a group poll is Available on **every** game of that window, including games of different teams, so in a slot covered by a group poll every available player is "available for" every team playing in the slot. Such a slot can therefore never be **Covered** (no team has own-only players); it is at best **Tight**, because the people who said yes still have to be split between teams. This is a faithful reading of what a group poll asks, not a defect.

## User Stories

- As a manager, I open Coverage and see, for each Saturday slot, how many distinct players I really have against the places I need, so I can see at once which slots are fine and which are in trouble.
- As a manager, I see a badge on each card, Covered, Tight or Short by N, in words as well as colour.
- As a manager, I see per team how many players are available, how many it needs, and how many of its available players could also play for another team.
- As a manager, on a Tight slot, I am told how the shared players have to be split between teams, so I know the plan works only if I manage them that way.
- As a manager, on a Short slot, I am told which team cannot reach its XI, how many more players to chase, and that unsure answers might close part of the gap.
- As a manager, I see who the shared (double-booked) players are, and how many answers are still unsure and not counted.
- As a manager, I see the games in each slot with their kickoff times, so I know which fixtures a card is about.
- As a manager, I filter by Season, Section and League, optionally include past slots, and my filters are remembered for next time.
- As a manager, I am told when the numbers might be incomplete because the grid hit its limits.
- As a manager on a phone, each card is one column with short labels and nothing scrolls sideways.

## Data Model Changes

None.

## API Contract

None. No endpoint is added or changed and `openapi.yaml` is untouched. Coverage calls only existing endpoints, through existing client functions: `listPlayerAvailability` (`ui/src/api/playerAvailabilityApi.ts`), `listLeagues`, `listSeasons`, `listSections` and `listTeamsForClub` (team names and the club's own teams). A future dedicated endpoint is listed in Rollout Notes.

## UI Requirements

Composed from existing pieces: the `073` hub layout and switch, `Input select`, `SectionTreeSelect`, `EmptyState`, `usePersistedListFilters`, `cardGridSx` (`utils/cardGrid.ts`), `badgeSx` (`RecordCard`) for the badges, MUI `Card`, `Chip`, `Alert`. New page-local files in `ui/src/pages/manage/availability/coverage/`: `AvailabilityCoveragePage.tsx`, `SlotCoverageCard.tsx`, `CoverageBar.tsx`, `CoverageLegend.tsx`, `slotCoverage.ts` (pure util, **no React**) and a test for each (pages and local pieces need no story; the util has the heaviest tests).

### 1. Route and switch (builds on `073`)

- `App.tsx` adds `<Route path="coverage" element={<AvailabilityCoveragePage />} />` as a child of the `availability` layout route, beside `index` and `players`.
- `AvailabilityHubLayout`'s switch gains its **third** button, **Coverage** (`/manage/availability/coverage`, icon `JoinInnerOutlinedIcon`, two overlapping circles as in the mockup; the build uses the nearest MUI icon if that one is missing from the installed version). The active-view rule gains `/coverage`. On `xs` the three buttons are equal thirds. New poll stays Polls-only, so it is hidden on Coverage.
- The dashboard tile's description (`073`) becomes "Polls, who is free, and squad cover".

### 2. Filters (`AvailabilityCoveragePage`)

A bordered surface in the same style as the Players page's filter panel (the build extracts that panel's `sx` into one shared constant used by both screens, behaviour unchanged, rather than a third copy). On `md` and up one row of **Season**, **Section** and **League** (three equal columns) and, beneath or beside them, the **Show past slots** `Switch` (default off, not persisted); on `xs` everything stacks in one column, nothing collapses behind a button (there are only three selects and a switch).

- **Season:** `Input select` of the club's seasons; effective value is the stored choice if it is still one of the club's seasons, else `pickDefaultSeasonId(seasons)`, derived and not written back (exactly the Players page rule). No "All seasons".
- **Section:** `SectionTreeSelect` with `allowClear` (the Players page's usage).
- **League:** `Input select`, "All leagues" plus every league of the club.
- **Persistence:** `usePersistedListFilters('availabilityCoverage:filters:' + clubId, { seasonId: null, leagueId: null, sectionId: null })`, a **separate** storage key from the Players view's (`playerAvailability:filters:<clubId>`), so the two views do not overwrite each other; **Show past slots** is plain `useState`.
- **Same semantics as the grid endpoint:** the page passes `seasonId`, `leagueId`, `sectionId` and `includePast` straight through (no `teamId`), and the request is held until the seasons have loaded (`filtersReady`), as on the Players page.

### 3. Data loading

One grid request: `listPlayerAvailability(clubId, { seasonId, leagueId?, sectionId?, includePast })`, query key `['managed-club', clubId, 'player-availability', { seasonId, leagueId, sectionId, teamId: null, includePast }]`, the Players page's key shape with `teamId: null`, so the same filters share one cache entry and anything that already invalidates the `player-availability` key refreshes Coverage too. Plus `listLeagues` (key `['managed-club', clubId, 'leagues']`, for `League.maxPlayingXiSize` by `game.leagueId`), `listSeasons`, `listSections` and `listTeamsForClub` (key `['managed-club', clubId, 'teams']`, for team names: the grid's game has a `label` but no team name). A team id with no match in the club's teams is labelled "Unknown team".

### 4. The slot util (`slotCoverage.ts`, pure, no React)

```ts
computeSlotCoverage({ games, players, xiSizeByLeagueId }): SlotCoverage[]
```

`xiSizeByLeagueId` is a `Map<string, number>` built from `listLeagues`. The util imports only types from `api/` and the date helpers (`dateHeading`, `kickoffText`, `slotLabel`) already in `playerAvailability/gridHelpers.ts`; it takes no clock and does no I/O.

**1. Slots.** A slot is the **local calendar date of `game.matchDate` plus `game.dayPart`** (`MORNING` or `AFTERNOON`). Games with `teamId === null` (no in-scope club team) are ignored. Slots are sorted by date ascending, Morning before Afternoon. A slot with a single game is a slot.

**2. Teams in a slot** are the distinct `teamId`s of its games (a team playing two games in one slot is one team). Per team:
- `availableIds`: the profile ids of players whose cell is `AVAILABLE` in **any** of that team's games in the slot. A group poll repeats one answer across every game of its window, and a team could have two games in the slot, so the answer is **de-duplicated**: a player counts once per team however many of the team's games carry the answer, and once in the slot's distinct set however many teams do.
- `unsureIds`: players `UNSURE` in any of the team's games and not in that team's `availableIds`. `UNAVAILABLE`, `NO_RESPONSE` and `NOT_IN_POLL` count for nothing.
- `needed`: `xiSizeByLeagueId.get(game.leagueId)` (if a team has two games in the slot with different sizes, the larger); `null` if any of the team's games has no league or the league is not found.
- `hasPoll`: at least one of the team's games has `pollType !== null` (a game without a poll has `NOT_IN_POLL` for everyone and carries no information).

**3. Derived per slot.** `distinctAvailable` = size of the union of the teams' `availableIds`. `sharedIds` = players in two or more teams' `availableIds`. Per team: `ownOnly` = available for this team and for no other team in the slot; `shared` = available for this team and at least one other. `distinctUnsure` = players `UNSURE` somewhere in the slot and not in the union of available (an unsure answer from someone already available is not unsure for the slot). `placesNeeded` = the sum of the teams' `needed`.

**4. Status.** First match wins:
- **`NO_POLL`:** any team in the slot has `hasPoll === false`. No assessment (badge "No poll yet"); that team's row reads "No poll yet · N needed" with an empty bar.
- **`NO_XI_SIZE`:** any team's `needed` is `null`. No assessment (grey badge **No XI size**, the league has no playing XI size known to the view); distinct count and per-team available counts only, no needed, no tick.
- **Single team in the slot:** `COVERED` if `available >= needed`, else `SHORT` by `needed - available`; no shared players, no matching.
- **Several teams:** run the matching below; let `matched` be the maximum number of places that can be filled.
  - **`COVERED`** when **every** team's `ownOnly >= needed` (no team relies on a shared player).
  - **`TIGHT`** when some team has `ownOnly < needed` but `matched === placesNeeded` (a full assignment exists, so it works only if the shared players are split a particular way).
  - **`SHORT`** when `matched < placesNeeded`; `shortBy = placesNeeded - matched`.

**5. Matching** (implemented in the util, no library): players on one side, team places on the other, each team a node with capacity `needed`, a player an edge to each team they are available for. Maximum assignment by augmenting paths (Kuhn's algorithm adapted to capacities: try to give a player to a team with spare capacity, otherwise try to move one of that team's current players to another of their teams, recursively, with a visited set per attempt). Players are tried in a fixed order (profile id) so the result is deterministic. Slots hold tens of players and a handful of teams, so cost is irrelevant. The function returns `matched` and, for each player, the team they were assigned to.

**6. Hints (`TIGHT` and `SHORT`).**
- **Tight:** for each team, `shortfall = max(0, needed - ownOnly)`. A full assignment exists, so each team can take its own-only players first and needs exactly `shortfall` shared players; `spare = distinctAvailable - placesNeeded`. Hint: "Works only if the 6 shared players are split: **2 to Villagers 1, 3 to Villagers 2** (1 spare)." Teams with a zero shortfall are not listed; with one team listed: "Works only if **2 of the 6 shared players** go to Villagers 1 (1 spare)."; the "(N spare)" part is omitted when `spare` is 0.
- **Short:** teams with `available < needed` are named as unable to reach their XI even with every shared player: "**Villagers 2 cannot reach 11** even with every shared player." If any shared players exist: "The 3 shared players are contended between …" (the teams that include them) is appended. If no team is individually short (they are contending for the same people): "**Villagers 1 and Villagers 2** need more distinct players than are available: the 11 shared players cannot fill both XIs." Both forms end with "**Chase 5 more players.**" (`shortBy`). A single-team SHORT reads "**Villagers 1** has 9 available and needs 11. Chase 2 more players."
- **Unsure mention:** the muted line (below) reads "4 unsure answers could close part of the gap" (or "...could close the gap" when `distinctUnsure >= shortBy`) on a Short card with unsure answers.

**Return shape** (per slot): `key`, `date`, `dayPart`, `games` (sorted by kickoff), `teams` (each with `teamId`, `needed`, `available`, `ownOnly`, `shared`, `unsure`, `hasPoll`), `distinctAvailable`, `placesNeeded`, `sharedIds`, `distinctUnsure`, `status`, `shortBy`, `split` (per team `shortfall` for Tight), `spare`. The util returns ids; the card resolves team names and player names.

### 5. Page body and states

- **Header row above the cards:** none beyond the hub's; a muted count line "N slots" (`slot`/`slots`).
- **Truncation notice:** when the response has `truncated`, an `Alert severity="info"` above the cards: "Showing the first {games} games and {players} players, so some slots or counts may be incomplete. Narrow the filters (season, league or section) to see the rest." (the Players page's notice, adapted).
- **Loading:** a centred `CircularProgress` with `aria-label="Loading coverage"`; **error:** `EmptyState` "Couldn't load availability coverage".
- **Empty states:** (a) the response has no games, or none with a club team: `EmptyState` "No games to cover" ("No games match the current filters. Try another season, section or league, or show past slots."); (b) games exist but **none has a poll**: `EmptyState` "No polls yet" ("Open a poll for these games to see how many players you have.") with a button **Go to Polls** to `/manage/availability`. When only some slots lack polls, those slots show their `No poll yet` card, not an empty state.
- **Grid:** `<Box sx={cardGridSx}>` (auto-fill, 380px floor, stretch) of `SlotCoverageCard`s, one per slot, followed by the legend.

### 6. `SlotCoverageCard`

A MUI `Card` with the same surface as `RecordCard`/`PollCard` (`background.paper`, `boxShadow: 2`, divider-bordered), not a `RecordCard` (it is not a record). Content stack, `gap: 1.5`, in this order:

1. **Header row:** the slot title **"Sat 17 Oct · Afternoon"** (`dateHeading` plus `slotLabel`, `subtitle1`-weight 700, wraps) and, right-aligned, the **status badge**: `Chip size="small"` with `badgeSx`, tone **Covered** `active` (green), **Tight** `season` (amber), **Short by N** `closed` (red), **No XI size** `muted` (grey), **No poll yet** `noPoll` (dashed). The text is always present; colour is never the only signal. No new badge tone is added (the existing tones carry the same colours as the mockup).
2. **Summary line:** "**23** distinct players available for **22** places" (numbers in tabular-nums bold; singular "1 distinct player", "1 place"). Non-assessed slots read "**23** distinct players available" (no places); zero reads "Nobody has said they are available yet". On `xs` the wording shortens to "**23** distinct players for **22** places".
3. **One bar row per team** (order: team name ascending): a label row with the **team name** on the left (bold) and, on the right in secondary text, **"15 available · 11 needed"** (`xs`: **"15 · need 11"**), then the bar. The bar is a 12px-high rounded (6px) track (`grey.300`) containing, from the left, a **solid segment** (`primary.main`) for players available **only** for this team, then a **striped segment** (45-degree stripes of `info.main` and a lighter tint, from the theme, no raw hex) for players also available for another team, and a **2px tick** (`text.primary`) standing 2px above and below the bar at the needed position. The scale is `max(available, needed)`: segment widths are `ownOnly / scale` and `shared / scale`, the tick sits at `needed / scale` (so at the right edge when needed is the larger). With no `needed` there is no tick and the scale is `available`; a team with no poll shows an empty track. The bar has `role="img"` and an `aria-label` carrying the numbers: "Villagers 1: 15 available, 9 only this team, 6 also available for another team, 11 needed" (the shorter forms when needed or sharing is absent). Heights and tick overshoot are exact so the mockup is reproduced; the mockup's bars are illustrative of the proportions, not a second source of the arithmetic.
4. **Hint box** (Tight and Short only): a rounded (8px) box on the `action`-wash background (the tinted surface the mockup shows), `InfoOutlinedIcon` for Tight and `WarningAmberOutlinedIcon` for Short, then the hint text from section 4.6 (bold parts as shown). On `xs` the Tight hint shortens to "Split the 6 shared players: 2 to Villagers 1, 3 to Villagers 2." (full team names; no abbreviations are invented).
5. **Shared players chip row** (Tight and Short, when there are shared players): chips of the shared players' names, **first 3 then a "+N" chip**; the "+N" chip is a button (`aria-expanded`) that expands the row to every name and, once expanded, toggles back ("Show fewer"). Names read "A. de Villiers" (first initial, family name), `title`/accessible name the full name; chip style as the mockup's "both" chip (info tint, `side` tone).
6. **Muted line**, secondary 12px: parts joined by " · " and omitted when zero: "**2 shared players**" (only when the chip row is not shown, i.e. on Covered and the non-assessed cards), "**3 unsure answers (not counted)**" (singular "1 unsure answer (not counted)"); on a Short card with unsure answers the unsure part reads "**4 unsure answers could close part of the gap**". The whole line is omitted when it has no parts.
7. **Match breakdown** (a divider above): one row per game of the slot, sorted by kickoff: the game's `label` ("Villagers 1 v CBC") left and the kickoff time (`kickoffText`, "10:00") right, wrapping on a narrow card. Plain text; not links.

**Phone** (`xs`, 375px first): one column; shorter team labels and summary as above; the hint shortens; the card never scrolls sideways and nothing in the header, chip row or legend clips (everything wraps).

### 7. Legend

Below the grid (not per card), an unordered list `aria-label="Legend"`, wrapping, three items with their swatches: a solid swatch **Only this team**; a striped swatch **Also available for another team**; a 3px by 12px dark tick **Places needed (playing XI)**.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit (Vitest), `slotCoverage.ts` (the heaviest tier) | Built from small fixtures of `GameColumn` and `PlayerRow` (a builder that makes players with cells per match). **Covered:** two teams, needed 11, V1 13 available with 2 shared (11 own-only), V2 13 available with 2 shared (11 own-only): `COVERED`, 24 distinct, 22 places, no hint. **The design's "23 distinct" example, V1 13 / V2 12 / 2 shared:** V2 has only 10 own-only players, so the rule gives `TIGHT` ("1 to Villagers 2", 1 spare), asserting the rule rather than the mockup's label. **Tight:** V1 15 (6 shared), V2 14 (6 shared), needed 11: `TIGHT`, 23 distinct, split 2 and 3, 1 spare. **Short:** V1 11 (3 shared), V2 9 (3 shared): `SHORT` by 5, 17 distinct, "Villagers 2" named as unable to reach 11. **Contention-only short:** both teams' available sets are the same 11 players: distinct 11, `SHORT` by 11, no team individually short, contention hint. **Augmenting path:** a case greedy assignment fails but augmenting succeeds (player A available for both teams, player B for team 1 only, each team needing 1): `matched` equals the total needed. **Dedupe:** a group-poll answer repeated on two games of one window counts a player once per team and once in the distinct set; one team with two games in one slot is one team. **Group-poll slot:** two teams, all available players available for both: never `COVERED`, `TIGHT` when the split exists. **Single team:** available at/over needed `COVERED`, under it `SHORT` by the difference, shared 0. **No league / league not found:** `NO_XI_SIZE`, distinct count only. **No poll:** a team whose games have no poll makes the slot `NO_POLL`. **Unsure never counted:** an unsure player is not in `distinctAvailable`, in a team's available, or the matching; `distinctUnsure` excludes someone available for any team; an unsure answer cannot turn `SHORT` into `COVERED`. `UNAVAILABLE`, `NO_RESPONSE`, `NOT_IN_POLL` count for nothing. **Different XI sizes:** two teams needing 11 and 9 (and an 11/11/9 three-team slot with overlapping availability): needed, places and verdict correct. **Three teams** in a slot, including a shared player in all three. **Slotting:** same date different day part are two slots; same slot across two sections is one slot; slots sorted by date then Morning first; a one-game slot; games with `teamId` null ignored. **Hints:** exact strings for the one-team-shortfall, two-team, zero-spare, short-named-team, contention and single-team forms. Empty input returns `[]`. |
| Component (Vitest/RTL) | **Cards** from a mocked grid response: title format, each badge text and tone (Covered, Tight, Short by N, No XI size, No poll yet), summary line with the right numbers and its `xs` form, one bar row per team with its label and the `role="img"` `aria-label` numbers, segment widths and the tick position from the scale rule (own, shared, needed larger than available), hint box and icon for Tight and Short only, chip row first three names then "+N" expanding and collapsing, muted line parts and omissions, match breakdown rows in kickoff order, legend present once. **Filters:** Season defaults via `pickDefaultSeasonId` and ignores a stale stored season; Section/League/Season send the right params to `listPlayerAvailability` (no `teamId`); Show past slots sends `includePast` and is not persisted; Season/Section/League persist under `availabilityCoverage:filters:<clubId>` and not under the Players key; the request waits for the seasons. **States:** truncation notice shown only when `truncated`, loading, error, "No games to cover", "No polls yet" with the Go to Polls link, a mix of polled and unpolled slots, the count line. **Route and switch:** `/manage/availability/coverage` renders the page inside the hub; the switch has three links with Coverage active and equal parts; New poll hidden on Coverage; the dashboard tile text. |
| Browser check | Phone (375px), two-column and wide, against a real club with two teams in some slots: cards one per slot with the badge, summary, per-team bars and hint exactly as the mockup (bars proportional, tick at the XI size, the striped part visible), expandable shared chips, nothing clipped or scrolling sideways at 375px, the legend below the grid wraps; filters persist across a reload and Show past slots resets; a squad-poll slot and a group-poll slot both compute plausibly (the latter never "Covered"); the truncation notice appears when filters are too wide; the Coverage tab keeps the switch fill and New poll disappears. |
| End-to-end | None new. |

No backend tiers apply: no backend change.

## Acceptance Criteria

- `/manage/availability/coverage` opens a **Coverage** view as the third tab of the Availability hub, with the switch labelled Polls, Players, Coverage in equal parts on a phone and no New poll button.
- Each time slot (local date plus Morning or Afternoon) of the filtered games is one card, in date order, including slots with a single club game, in the shared card grid.
- A card shows the slot title, a badge in words (Covered, Tight, Short by N, No XI size, No poll yet), "N distinct players available for M places", and for each team a labelled bar and "N available · M needed", with the bar's `aria-label` carrying the numbers.
- The verdict follows the rules: Covered only when every team has enough players available for it alone, Tight when a full assignment exists but needs shared players, Short when not even a maximum matching fills every place (shortage = places needed minus the matching size). A Tight card says how many shared players each team must take; a Short card names the team that cannot reach its XI and says how many more players to chase.
- Unsure answers are never counted as available; they appear separately as "N unsure answers" and, on a Short card, as a possible way to close part of the gap.
- The same player available on several games of one group-poll window, or for several teams, is counted once in the distinct number.
- Shared players are listed (first three names then "+N", expandable) on Tight and Short cards.
- A slot with a game that has no league shows "No XI size" and only distinct counts; a slot with a team that has no poll shows "No poll yet"; neither pretends to a verdict.
- Season, Section and League filters (plus Show past slots) work with the same meaning as on the Players view, persist per club under their own storage key (except Show past slots), and Season defaults to the current season.
- When the grid reports `truncated`, the page says its numbers may be incomplete. Empty states cover "no games" and "no polls yet" (with a link to Polls).
- Colour is never the only signal anywhere on the view, and nothing scrolls sideways at 375px.
- No backend, migration or `openapi.yaml` change is part of this spec.

## Rollout Notes

- **Build after `073`**, which creates the layout, the switch and the route pattern; this spec adds the third button, the route, the dashboard tile text and the Coverage page. Frontend only, one PR, no migration, no flag.
- **Source of "playing XI size" is `League.maxPlayingXiSize`**, read from `listLeagues`. Draft `055` (not built, not touched here) would move that field onto `LeaguePlayingConditions`; if it is built first, only the construction of `xiSizeByLeagueId` changes.
- **Not touched:** the user's drafts `055` and `058`.
- **Roadmap additions** (`docs/roadmap.md` is a living index; the build PR adds these, this spec does not edit it):
  - A **dedicated backend endpoint** for coverage (exact per-slot audiences, club-wide counts, no 150-game/500-player caps, no dependence on the grid's row candidates), replacing the client-side computation once a club outgrows the grid's limits.
  - **Derby support:** the grid response must carry every own team of a game (both sides of a derby) so each team is counted.
  - **Per-player rotation hints:** which shared player to give to which team (games played, recent picks), beyond the "how many" hint.
  - **Considering picked players:** a player already picked for one team in the slot is not free for another; today `picked` is ignored.
  - Possible follow-ups noted while specifying: link a slot card to the Players view or its polls; per-team squad sizes beyond the playing XI (reserves).
- **Open points for the build (none blocking):** the extracted shared filter-panel style and where it lives; the icon for Coverage if `JoinInnerOutlined` is unavailable.
