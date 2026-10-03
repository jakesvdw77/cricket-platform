# 068 — Player Availability Grid

**Depends on:** `064-unified-availability-polls.md` (squad and group polls, one poll per match), `063-section-availability-and-flexible-squads.md` (group polls: rounds, windows, `SectionAvailabilityResponse`, `MatchSquadMember`), `032-match-availability-polls.md` (squad polls, `PlayerAvailability`), `065`/`067` (the Responses pages a cell links to), `025`/`026`/`035` (sections, teams, section-scoped access), `029` (team squads), the league and season specs for `Match.leagueId`/`seasonId`.
**Status:** approved (design approved by the user). Design: https://claude.ai/artifact/XmHwCXhsmRY3qECVf6hKmP (legacy reference: the legacy app's Team Availability "Per Player" tab).

## Problem & Goals

A coach or manager can see one poll at a time (the Availability Polls list and each poll's Responses page) but has no way to see **a whole season of availability at a glance**: who is free for which games, week after week, and who has not yet been picked. That is what makes advance planning and rotation possible. The legacy app had this as the Team Availability grid; the new platform has the data (squad polls, group polls, picked squads) but no screen.

**Goals**
- A new screen, **Player Availability**, separate from **Availability Polls**: a grid with **games as columns** (grouped under date, then Morning or Afternoon) and **players as rows**, with a tick, question mark or cross for each player for each game.
- **Group-wide or team-specific through filters only**: a Season, League, Section and Team filter narrow the grid; nothing is configured per team and no team flags are added.
- Show **which players were picked** for each game, with a per-player picked count, to help rotate players.
- Clicking a cell opens that game's poll. The grid itself is read-only.

## Non-goals

- **Editing an answer from the grid.** Clicking a cell opens the poll's Responses page, where managers already correct answers (`065`/`067`).
- **A "By match" view** (a card per game listing who is available, like the legacy Per Match tab). Possible later; not in this version.
- **Per-team settings or flags** to switch the view between group and team. The Team filter is the only control.
- **Exporting, printing, notifying or nudging players** from the grid.
- **Changing how polls are created, answered or closed.**
- **Players who have not been included in any poll for a game.** They show a dash (not part of that game's poll); the grid does not invent availability.

## User Stories

- As a coach, I open **Player Availability** and see the season's games across the top, grouped by date and Morning/Afternoon, and my players down the side, so I can see who is free for which games.
- As a coach, I filter by Season, League, Section and Team; choosing a Section with "All teams" shows the whole group, choosing one team shows only that team's games and squad.
- As a coach, each cell shows tick, question mark, cross, a hollow circle for "no response yet", or a dash when the player is not part of that game's poll; none of these relies on colour alone.
- As a coach, I see which players were picked for a game (a dot on the cell) and how many games each player has been picked for, so I can rotate players.
- As a coach, I see per-player answered counts and per-game totals (available, unsure, unavailable).
- As a coach, I click a cell and land on that game's poll; a game with no poll offers to open one.
- As a coach on a phone, the player column stays in view while the games scroll sideways in their own box.

## Data Model Changes

None. The grid is a read-only aggregation of existing data.

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/player-availability` | `@access.canAccessClub`; section scope enforced in the service exactly like `GET …/availability-polls/open` (an out-of-scope `sectionId` is `403`, another club's is `404`, no `sectionId` narrows to the caller's accessible sections) | **New.** Query params: `seasonId`, `leagueId`, `sectionId`, `teamId` (all optional), `includePast` (default `false`). Returns `{ games: [...], players: [...] }` below. |

**Response shape (one request fills the grid):**
- `games`: ordered by date then kickoff; each `{ matchId, matchDate (instant), dayPart (MORNING|AFTERNOON), label (e.g. "Villagers 1 v CBC"), venue, leagueId, leagueName, teamId (this club's team in the game), pollType (SQUAD | GROUP | null), pollId (squad poll id, or group round id), roundId? }`. A game with no poll has `pollType: null`.
- `players`: ordered by name; each `{ playerProfileId, firstName, lastName, jerseyNumber, pickedCount, answeredCount, cells: [ { matchId, status (AVAILABLE|UNSURE|UNAVAILABLE|NO_RESPONSE|NOT_IN_POLL), picked: boolean } ] }`, one cell per game.

**Derivation rules (the same sources and audience rules the poll screens already use, so the grid cannot disagree with them):**
- **Games (columns):** matches in the club, in the chosen Season and League, involving one of the club's teams in the chosen Section (or the chosen Team only); upcoming only unless `includePast`.
- **Players (rows):** the players in the chosen Section's audience, or the chosen Team's squad.
- **Cell status:** if the game is covered by a **group poll**, the player's answer for that game's window if the player is in the poll's audience, else `NOT_IN_POLL`; if covered by a **squad poll**, the player's answer on that poll if they are in its audience, else `NOT_IN_POLL`; if the game has **no poll**, `NOT_IN_POLL` for everyone. An answer not yet given is `NO_RESPONSE`.
- **Picked:** the player is in the game's `MatchSquadMember` set (group-covered games) or the team's selected squad/playing XI for that game.
- A group poll's answer is the player's answer for the whole slot, so it appears on every game in that slot; squad polls give a per-game answer.
- **Size:** the result is bounded by one season and one section (hundreds of players and tens of games at most), so it is returned in one response rather than paged, as `034` reasoned for the open polls list; the service applies a documented hard cap and the filters are what keep it small.

## UI Requirements

Composes existing pieces (`ManageScreenHeader`, `ListToolbar` filters, `SectionTreeSelect`, `usePersistedListFilters`, `EmptyState`); the grid itself is new and page-local. Route `/manage/player-availability`, reached from a new **Player Availability** card on the manager dashboard, separate from **Availability Polls** (the page header links to it).

- **Toolbar:** Season (default: the current season), League (only leagues that have games in view), Section (tree select), Team (within the chosen Section, "All teams in section" by default), player search. Season, League, Section and Team persist per club via `usePersistedListFilters`; search does not. Switches **Show past games** and **Hide players with no answers** (both off by default, reset each visit). A **Jump to today** control scrolls the grid to the next game.
- **Grid:** sticky first column (shirt number and name) and sticky header rows. Header rows: date; then Morning/Afternoon; then one column per game (label, kickoff time, league). The next game day is marked. Slots with no games are omitted. Right-hand **Answered** and **Picked** columns; a footer row with Available / Unsure / Unavailable counts per game.
- **Cells:** a glyph in a circle: ✓ available, ? unsure, ✗ unavailable, hollow dashed circle no response, a dash for not part of that game's poll; a small dot marks "picked". Each cell has an accessible name and tooltip ("Anton de Villiers, Sat 3 Oct Morning, Villagers 1 v CBC: Available, group poll"). Colour is always paired with the glyph.
- **Navigation:** clicking a cell opens the game's poll (`/manage/availability/group/:roundId` or `/manage/availability/squad/:matchId/:pollId`); for a game with no poll the column header offers "Open a poll" (`/manage/availability/new?type=…&matchId=`). To avoid thousands of tab stops, cells are not individually focusable; the **game column header** is the keyboard-reachable link to the poll.
- **Legend** below the grid. **Empty states:** no games match the filters; no polls opened yet for the games (with a link to Availability Polls).
- **Phone:** the first column stays in view, the games scroll inside their own box (never the page body), slot headings read AM/PM and game labels shorten; the filters collapse to Team and League with the rest behind a filter control. Nothing in the header or legend is clipped at 375px.

## Test Plan

- **Backend unit/integration (`testing.md`):** aggregation correctness for a group-covered game, a squad-covered game, a game with no poll, a player in both teams' squads with different answers on two games in one slot (two separate cells), `NOT_IN_POLL` for players outside a poll's audience, `picked` from `MatchSquadMember` and the selected squad, filters (season, league, section, team, `includePast`), ordering, the hard cap, and section-scope `403`/`404` on the endpoint; custom queries covered by Testcontainers tests; `openapi.yaml` updated.
- **Frontend (Vitest/RTL):** header grouping (date, slot, game) from a mocked response, cells for every state with accessible names, Answered/Picked/footer totals, filters call the endpoint with the right params and persist (not search), Show past games and Hide players with no answers, cell and header navigation targets for group, squad and no-poll games, empty states, sticky/scroll containers present, dashboard card navigation.
- **Browser check at phone, 2-column and desktop widths** (no clipped header or legend; first column stays visible).

## Acceptance Criteria

- A manager opens **Player Availability** from the dashboard and sees the season's games as columns under date and Morning/Afternoon, with the players down the side and a tick, question mark, cross, no-response circle or dash in each cell.
- Choosing a Section with "All teams" shows the whole group; choosing a Team shows only its games and squad; League and Season narrow the games; nothing is configured per team.
- Picked players are marked on each game and counted per player.
- Clicking a cell (or a game header) opens that game's poll; the grid cannot edit answers.
- No state is communicated by colour alone, and the screen is usable at 375px.
- The grid agrees with the poll screens: the same answers, audiences and open/closed data.

## Rollout Notes

Backend first (one read endpoint), then frontend. The "By match" view, exporting, and notifying non-responders are natural follow-ups. A very large club might eventually need the grid virtualised or paged by date range; the filters and the hard cap keep this version small, and the cap is the signal to revisit.
