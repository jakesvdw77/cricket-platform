# 145: Player Hub Results (Schedule > Results) and the player-facing stats foundation

**Status:** draft 2026-11-06, amended the same day with the owner's answer on the scorecard and names (Decisions). The owner will answer the remaining open questions separately. Requested by the owner: add results to the Player view, showing the matches played and potentially the player's recent results; suggestions welcome; a drillable stats section for the player and the team will follow on the Player view, so fold the two into one spec where that avoids duplicated effort. **Recommendation: one spec** (this one): the effort is in the player-facing access and privacy rule over the stats reads, which Results and Stats both need; Results is the first and smallest screen on it. The Stats screens (`stats.mine`, `stats.teams`) stay "Soon" and get their own later spec that only adds UI.
**Depends on:** `121` (Hub menu, `hubNav.ts`, `MyPlayerAccess`, phone rules), `135` (Schedule > Matches, the Hub match row, `MyMatchService`, the Hub privacy rule and the dark console tokens `HUB`), `115` (the player match list: `PlayerMatchListService`, `PlayerMatchRowDto`, its Privacy section and decision H, "the later player view is a new controller and access rule over the same service"), `103` and `117` (the counting rules, `PlayerStatsDto`, `PlayerDashboardDto`, `FormStrip`), `114` and `122` (`shareName` and the junior rule), `143` (page anatomy, where the Hub differs).

## Problem & Goals
A parent or player in the Player Hub can see what is coming (Schedule > Matches, `135`) but not what has happened: **Schedule > Results** is a "Soon" item ("Published results for this player's teams"). The data exists and is already counted correctly for managers: `GET .../players/{playerId}/stats/matches` returns one row per counted match with the result from the player's side and the player's own batting, bowling and fielding. It has no player-facing route.

**Goals**
- **A. Schedule > Results goes live:** the matches the selected player has played, newest first, each with the team's result and the player's own figures, plus a recent-form strip at the top.
- **B. One player-facing foundation for stats:** a `MePlayersController` family of reads, guarded by `MyPlayerAccess.resolve`, that wraps the existing `103`, `115` and `117` services with no second copy of the counting rules, and a Hub privacy rule applied once. Results uses the matches read now; `Stats > My stats` and `Team stats` will use the other two later.
- **C. Built to be drilled into later:** the Results header tiles and the form strip are the entry points of the later Stats section, so nothing built here is thrown away.

## Non-goals
- **The Stats screens.** `stats.mine`, `stats.boards`, `stats.teams` stay Soon. This spec adds no Stats UI and no ranking; leaderboard visibility for players keeps the open questions of `103` decision 6.
- **Any change to the counting rules, the manager stats pages or the manager Matches list.** No schema change.
- **Sharing, export, live scoring.** As `135`.

## Decisions (owner, 2026-11-06)
1. **Names are shown.** The Player Hub is for authenticated users, so the Hub Result page shows the full scorecard with names; the earlier "no other person's name" rule of this draft is dropped (it was this draft's choice, not an owner rule).
2. **A flag publishes a result to the player view.** A result reaches the Player Hub only when a manager has switched it on (**Show In Player Hub**). Publishing the result to the club (`published_at`) and showing it to players are two separate steps, so a manager can capture and publish a result for the club's own pages and check it before parents see it.
3. The other open questions (2 and 4 to 9 below) are answered separately.

## What the player sees (suggestions, for the owner to pick from)
**Schedule > Results page** (dark console, `HUB` tokens, rows follow `135` section 0: one tap target, 44 px, no chevron, no kebab):

1. **Season at a glance** (four compact static tiles, no ranking): **Played**, **Won**, **Runs** or **Wickets** for the player's role?, **Catches**. Suggested set: Played, Won, Runs, Wickets (a parent wants "how is the team doing" and "what has my child done"). Each tile later drills into `stats.mine` (a link target reserved in `hubNav.ts`, not shown now).
2. **Recent form strip:** the last five results as W / L / T chips in date order (the team's result) with the player's own score under each ("46*", "1/24"), built from `117`'s `FormStrip`. Honest about gaps: a match with no scorecard shows the result and a dash.
3. **Matches played list** (the main content), newest first, a Show More button (backend paged, as `115`):
   - date, the team the player played for (a chip when the player has more than one team), "v Opponent", competition or Friendly;
   - the result in words from the player's side ("Won by 8 wickets"), with a Won, Lost, Tied, No Result chip;
   - the player's own line ("46* off 68 · 1 for 24 · 1 catch"; "Did not bat" or "No scorecard captured" in muted words, never zeros) and a player-of-the-match star;
   - the row opens the Hub **Result page** (below).
4. **Season control:** one Season picker (default the current season, All Seasons offered). No other filters in v1 (a player has few matches; team is a chip on the row).
5. **Empty and error states:** "No results yet. Finished matches will appear here." and the standard Try Again.

**Hub Result page** (`/account/players/:key/results/:matchId`): the result line and both scores, date, league and venue (the `135` match header and figures, static compact), the held player's own card highlighted first, then the **full scorecard** of both innings with names (Decision 1: batting with how out, bowling, extras, fall of wickets only if the manager's result page shows it, the awards), and a footer Back to Results. Only results with **Show In Player Hub** on are reachable and listed (Decision 2); any other result is a 404.

## Data model and the manager control (Decision 2)
- **Column:** `match_result.visible_to_players boolean not null default false`, plus `visible_to_players_at timestamptz` and `visible_to_players_by` (who and when), in the next sequential Liquibase migration (`new-migration` skill). Existing published results are **not** backfilled (default off: nothing becomes visible to parents by the upgrade).
- **Manager UI:** on the result page, **Show In Player Hub** and **Hide From Player Hub** in the **Manage Result** menu (after the status transitions, `page-anatomy.md` section 6b), each with a one-line explanation; a published result shows a small badge ("In Player Hub") beside the Published badge when on. The Capture wizard's Review step offers the same switch beside Publish (off by default, "Parents and players can see this result"). A draft or unpublished result cannot be shown to players (the item is disabled with its reason).
- **Rule:** a result is visible to players only when it is published (`published_at` set) **and** the flag is on; unpublishing a result also turns the flag off. Importing a result (`104`) sets nothing: it stays off until a manager switches it on.
- **API:** `POST` and `DELETE` `/api/v1/manage/clubs/{clubId}/results/{resultId}/player-visibility` (club admin or the result's section manager, as publish), audited like publish; the result DTO gains `visibleToPlayers`.

## Backend (new reads)
| Endpoint | Wraps | Purpose |
|---|---|---|
| `GET /api/v1/me/players/{playerKey}/results?seasonId=&page=&size=` | `PlayerMatchListService` (`115`) | The held player's counted matches as `MyResultListDto` |
| `GET /api/v1/me/players/{playerKey}/results/summary?seasonId=` | `PlayerStatsService` (`103`) | The four tiles and the form strip inputs (only the fields the page shows) |
| `GET /api/v1/me/players/{playerKey}/results/{matchId}` | the match row + the `135` match header | One result as `MyResultDto` |

Same access as `135`: `MyPlayerAccess.resolve` only, **and only for results with the flag on** (the list, the summary tiles and the form strip all count flagged results only, so what a parent sees adds up); key not held, malformed or dropped-out player is **404**, SUSPENDED is **403**, a `matchId` that is not one of the held player's counted matches is **404**. All three go in `MePlayersController`, thin, delegating to a new `MyResultService` (interface and impl, `@Transactional(readOnly = true)`) that calls the existing services and maps to Hub DTOs. The counting rules stay in `PlayerStatsSql` (`APPEARANCES`); the parity rule of `115` (sum of the rows equals the `103` totals, rows equal `basis.matchesCounted`) is tested again through the Hub route. **Later:** `GET .../stats` and `GET .../stats/dashboard` for the Stats section are added to the same family with the same access and the same DTO mapping rule.

**Privacy (server, one place).** The Hub DTOs carry what a signed-in parent sees on the published scorecard: player names (Decision 1), team and opponent names, scores and awards. They never carry draft or unpublished data, a result with the flag off, internal ids beyond the match id, contacts or medical data, guests' or import-guess rows' internals, or another club's data. A result is read only through a held player who has a counted appearance in it. A test asserts the exact JSON keys of each DTO (as `135`) and that a flag-off result is 404 on every read. **Open (one line for the owner):** the platform's junior rule (`114`, `122`, `135`) shows players under 18 as initials in anything shared or shown beyond the club; keep it on the Hub scorecard (default: **yes, initials for juniors**, the held player's own name in full), or show full names to authenticated users as well?

## Frontend
Reuse: the Hub shell (`HubFrame`, `HubMenu`, `hubNav.ts`: turn `schedule.results` from Soon into a page and add the `results/:matchId` route), the Hub row anatomy and `HUB` tokens from `135`, `FormStrip` and the result words helper from `117`/`138`, `useNow` not needed. New: `HubResults.tsx` (page), `HubResultRow.tsx`, `HubResultPage.tsx`, `HubResultFigures` (compact tiles in the Hub console style), `api/meResultsApi.ts` (keys under `['me', 'players', key, 'results', ...]`). Back from the Result page returns to the same Season and scroll position (`hubBack`).

## Hub and manager standard
The Hub keeps its own console look (dark, `HUB` tokens, footer Back); the page anatomy rules that survive are: Title Case labels, compact figures without icons, no count text ("Showing N"), a link when nothing exists, one tap target per row. No chevron, no kebab (as `135`).

## Test Plan
- **Backend:** `MyResultService` (ownership, 404 and 403 cases, another club's match, the counted-match rule through the Hub route, parity with `103`), the exact JSON keys per DTO, `MePlayersController` access.
- **Frontend:** `HubResults` (tiles, form strip, row content, Show More appends, Season change, empty and error), `HubResultPage` (header, own card, Back restores the Season), `hubNav` (Results is a page, no longer Soon; two levels and seven items still pinned).
- **Not run:** Playwright; the 375 px check is the owner's.

## Acceptance Criteria
1. Schedule > Results lists the held player's counted matches whose result is shown in the Player Hub, newest first, with the team result and the player's own figures; no ranking.
2. The form strip shows the last five results with the player's own score under each.
3. A row opens a Hub Result page with both scores, the player's own card and the full scorecard with names; Back returns to the same Season.
3a. A manager can show or hide a published result in the Player Hub (Manage Result, and the Review step); a result with the flag off is absent from every Hub read (404) and from the tiles and the form strip; unpublishing turns the flag off.
4. A held-player key not held, a dropped-out player and another club's match are 404; SUSPENDED is 403.
5. The rows equal `basis.matchesCounted` and the tiles equal the `103` totals for the same Season.
6. Stats > My stats and Team stats remain Soon; nothing here blocks them.

## Open questions (default if unanswered)
1. **Where it lives:** Schedule > Results only (the existing slot)? Default: **yes**; the same list's first rows also feed a "Recent" row on Matches later.
2. **Tiles:** Played, Won, Runs, Wickets? Default: **yes** (Played and Won are the team, Runs and Wickets the player). Alternative: Played, Won, Lost, Win percentage for the team only, with the player's figures only in the rows.
3. **Resolved (Decision 1):** the full scorecard with names. **Still open:** juniors as initials (see Privacy).
3b. **Flag default and backfill:** off for every existing and new result until a manager switches it on, no backfill? Default: **yes**. Alternative: a club setting "Show new results in the Player Hub by default", and a one-off "Show all published results" action.
4. **A player in two teams:** one list with a team chip on each row? Default: **yes** (not a team filter).
5. **Season control:** current season default, All Seasons offered, no other filters? Default: **yes**.
6. **Form strip length:** last 5? Default: **5**.
7. **Team results for matches the player did not play** (selected but no card, or unselected)? Default: **not listed**: Results is "matches played" (the counted appearances of `115`); the team's other results stay on Matches or the league page.
8. **Stats entry points:** the four tiles link nowhere until the Stats section exists (plain static cards now)? Default: **yes**, plain cards; the drill link is added with the Stats spec.
9. **One PR**, backend and frontend, with `121`, `135`, `115` and `roadmap.md` updated? Default: **yes**.

## Rollout Notes
Backend: one migration (the flag columns) and the read and visibility endpoints, plus the manager menu items and the Hub UI; `openapi.yaml` regenerated and the contract check run. Update `hubNav.ts` (Results live), `docs/specs/121` (menu item no longer Soon), `docs/architecture.md` if the Hub access diagram lists the `me/players` reads, and `docs/roadmap.md` (row `145`, and the Stats section row pointing here for its foundation).
