# 147: Player Hub Stats: My stats, Team stats and Leaderboards as flip cards on one extensible card registry

**Depends on:** `103` (the counting rules, `PlayerStatsCalculator`, `PlayerStatsDto`, the leaderboard catalogue and tables, decision 26 "tables, sorted by a chosen column", the data availability tables and the `notCaptured` catalogue), `115` (`PlayerMatchListService`, the shared `APPEARANCES` SQL), `116` (`TeamStatsCalculator`, `TeamStatsDto`, the counted team result), `117` (`PlayerDashboardService`, `TeamDashboardService`, the series builders, `DashboardLimits`), `121` (Hub frame, `hubNav.ts`, `MyPlayerAccess`, phone rules, the reserved `HubNavContext.clubSwitches` slot, and the Rollout table that marked My stats "optional", Leaderboards "yes, off by default, needs a safeguarding rule" and Team stats "optional"), `135` (Hub row anatomy, the stretched-link pattern), `145` (the Hub Results foundation: `MyResultService`, `StatsScopeResolver.resolveForHeldPlayer`, the `playerVisibleOnly` flag, `PlayerStatsSql.APPEARANCES`, `HubPageHeader`, the Season dropdown plus Filters pattern, Decisions 6a, 7, 8, 11, 13, 14 and the chart rules), `146` (the item contract plus kind registry that this spec copies for cards), `114` and `122` (`shareName`, `isJuniorMatch`, the junior rule that must still hold on every export path), `120` (no hex literals, `brandTokens.ts`), `docs/standards/*.md`, `docs/standards/page-anatomy.md` (section 0 build checklist; section 4 for where the Hub differs).
**Status:** draft, 2026-11-07. Owner decisions of 2026-11-07 (listed under Decisions) are binding and not reopened here. Mockups: `docs/mockups/player-hub-stats-round1-mockup.html` (page shapes, the match drill, Leaderboards as a table) and `docs/mockups/player-hub-stats-round2-mockup.html` (round 2: the flip cards, content and tags; the visual and content direction). No code is written by this spec.

> **AMENDMENT (owner, 2026-11-07), SUPERSEDES every mention below of the club switch, migration `063`, `hub_leaderboards_enabled`, the `hub-settings` endpoints, the manager "Player Hub" card on Club profile, `clubSwitches.leaderboards` and the 404-when-off rule.** The owner is taking legal advice on showing children in rankings and, until then, wants to see the cards and how the pages look: **leaderboards, ranks, "Where Sam stands" and the within-team rank are shown to every held player, with no club switch and no migration.** The Leaderboards menu item is always visible. Open question 7 is resolved as its alternative ("no switch"); Open question 11 is resolved as "shown". The builder must not create `063`, the settings endpoints or the manager card. **Safeguarding is a deferred, named decision, not a dropped one:** keep the ranking reads behind one small server-side predicate (`HubRankingPolicy.allowsRankings(club)`, today always true) and one UI helper, so a club switch, an age rule or a legal restriction can be added later in one place without touching the cards. A later spec adds whatever the legal advice requires (a switch, hiding children's ranks, or both). Record this in the roadmap as an open legal item.

## Problem & Goals
The Player Hub now shows what has happened (Results, `145`) and what is coming (Matches, `135`), but its Stats group is three "Coming soon" panels: My stats, Team stats and Leaderboards. The figures exist and are already counted correctly for managers (`103`, `116`, `117`), and the held-player access, privacy and flagged-results rules were built for Results. What is missing is a player-facing way to read them that sells the app to parents: a striking, mobile-first set of cards where each card is a headline on the front and the story behind it on the back, honest about how much data stands behind every figure, and built so the owner can keep adding cards without touching the page.

**Goals**
- **A. My stats** (`stats.mine`): the held player's own batting, bowling, fielding and "as a teammate" cards, drilling down to the innings behind each figure.
- **B. Team stats** (`stats.teams`): the player's team (record, contributions, matchups, squad) in the same card form.
- **C. Leaderboards** (`stats.boards`): the `103` standings as tables with Sort by, the viewer's own row highlighted, and a "Where Sam stands" flip card on top, behind a club switch (see Decision 10).
- **D. A card contract and a registry** (the `146` ticker pattern): a card is one file plus one registry entry; the page, the grid, the flip component and the endpoint are never edited to add one. A guard test pins it.
- **E. One definition of every number.** All figures come from `PlayerStatsCalculator` and `TeamStatsCalculator` (and their series builders). No second copy of any counting rule, in SQL, a mapper or the browser. Parity tests like `115` and `145`.
- **F. Honest by construction**: every figure carries "based on N of M results"; a card says PARTLY or NOT CAPTURED where the scorecard lacks data. No ball-by-ball, fall-of-wickets, partnership or per-over data exists, so nothing here promises worm charts, powerplay or death splits, wagon wheels or partnerships; they are listed as "Not captured yet" future cards.

## Non-goals
- **Any card that needs data the scorecard does not capture**: worm chart, run rate by phase (powerplay, middle, death), partnerships, fall of wickets, scoring zones and wagon wheels, batter dot-ball percentage, boundaries conceded, wicketkeeper dismissals, dropped catches, direct hits. They appear only as "Not captured yet" entries (see Rollout Notes for what each needs first). Results capture does not change (`103` decision 3).
- **Any export, share, download, print layout or public page of Hub stats.** Juniors are shown by full name inside the logged-in Hub (Decision 3), so nothing here may leave the screen. See "No export" in the UI section: guard test and a rule for any future share path.
- **Percentile or "top N percent" rankings.** Not built (Open question 4). Ordinal ranks appear only on Leaderboards and the "Where Sam stands" card, behind the club switch.
- **Comparing two named players, or any player-versus-player view.**
- **Changes to the counting rules, the manager stats pages, the manager leaderboards or results capture.** The manager reads behave exactly as today (the new flags default to "not Hub").
- **Stats for matches the Player Hub does not show.** Only published results with Show In Player Hub on count (`145` Decision 2), so every figure agrees with the Results page.
- **Player-recorded own games, cross-club career stats, per-club time zones, push notifications.** As `103` and `145`.
- **Club-authored cards or a card editor.** Cards are code, added by the developers; the owner adds many, but through the registry.
- **A new chart library.** `145`'s chart rules stand (own small SVG for the Hub, `@mui/x-charts` only for manager charts under `components/charts/**`).
- **Changing the Results page** (it is not given new links by this spec; Open question 10) and **the manager application** (no "view as parent" preview).
- **Playwright runs.** The 375 px, keyboard and reduced-motion passes are the owner's.

## Decisions (owner, 2026-11-07; not reopened)
1. **Every card flips** (tap to flip). The front is the headline, the back is the story behind it. No card is front-only.
2. **The layout is solid for future additions.** A card contract and registry (like `146`'s `TickerKind` registry): each card = id, group, title, front renderer, back renderer, data-availability tag, the stats fields it needs, and an order. Adding a card is one file plus one registry entry, never an edit to the page, the grid, the flip component or the endpoint. A guard test pins that the page imports no individual card. Cards read ONE stats payload per page (no per-card requests). A card whose data is missing renders nothing or a clear "Not captured yet" state.
3. **Juniors are shown by full name inside the logged-in Hub** (as `145` Decision 7), but NEVER in an export, share or public page. A guard test is added now and a rule applies to any future share path.
4. **Same flagged-results-only rule as Results**: published AND Show In Player Hub on, so figures agree with the Results page.
5. **Copy names the player by first name**, never "you" or "your" (`145` Decision 6a); the fallback is "This Player".
6. **The numbers come from the SAME `PlayerStatsCalculator` and `TeamStatsCalculator`** as the manager pages. Parity tests.
7. **Scope controls reuse the Results pattern**: a Season dropdown plus Filters (League, Team) through `HubPageHeader`, persisted per player.
8. **Tiles and graph points drill**: a tile opens the innings behind it (the "match drill"); a row or a dot opens the Hub Result page.
9. **Honesty**: every figure carries "based on N of M results"; cards say PARTLY or NOT CAPTURED where the scorecard lacks data.
10. **(Reconciling `121`.)** `121` recorded that a Hub leaderboard needs a club switch (off by default) and a safeguarding rule for children, and that My stats is "never ranked against other players". This spec keeps both: every ranking of one player against others (the Leaderboards page, "Where Sam stands", and the two ranking lines on My stats backs) is shown only when the club has switched Player Hub leaderboards on (default off, one small migration, see Data Model). With the switch off, My stats and Team stats are fully live and contain no ranking. This is stated here rather than quietly built around; Open question 7 records the alternative.

## User Stories
- As a parent, I open Stats then My stats and see Sam's season in cards (runs, wickets, catches and more), so that I get the story of the season at a glance.
- As a parent, I tap any card and it flips to the story behind the headline, and tap again to go back, so that detail is there when I want it and out of the way when I do not.
- As a parent, I tap a tile or a dot on the innings graph and see the innings behind it, and tap a row to open that match's full scorecard, so that I can check any number.
- As a parent, I choose a Season and, with Filters, a League and Team, and every card follows, remembered for this player on this device.
- As a parent, I see on every card how many results stand behind it ("based on 6 of 7 results"), and where the scorecard does not record something I am told it is not captured yet, never shown a zero.
- As a parent of a player in two teams, I can look at either team's stats.
- As a parent, I open Team stats and see how the team is doing: record, where the runs and wickets come from, batting first versus chasing, and how big the squad is.
- As a parent, when the club has switched leaderboards on, I see the standings as tables sorted by the column I choose, with Sam's row highlighted and a "Jump to Sam" link, and a "Where Sam stands" card at the top.
- As a parent whose club has not switched leaderboards on, I never see a ranking of children, and the Leaderboards item says so plainly.
- As a screen reader user, I can read both faces of every card without flipping, and every graph has a table on the back.
- As a parent who is sensitive to motion, I see a quick fade instead of a 3D flip.
- As the platform owner, I add a new card by writing one file and one registry line, and the page, grid, flip component and endpoint do not change.
- As a club administrator, I can switch Player Hub leaderboards on or off for my club.

## Data Model Changes
**One small migration, and it is truly needed**: `backend/src/main/resources/db/changelog/v1/063-club-hub-leaderboards.sql` adds `club_profile.hub_leaderboards_enabled boolean not null default false`, the club switch that `121` required for Leaderboards (Decision 10). Nothing else: no stats table, no cache, no index (statistics stay computed on read, `103`). It mirrors `051` (share settings) and `052` (award categories): read and written only through `ClubHubSettingsController` and `ClubHubSettingsService`; the club profile `PUT` never resets it; a club with no profile row reads as false. The `061`/`062` flag `match_result.visible_to_players` already exists and is the Hub filter.

No new entity. The Hub reads the existing result, availability and selection tables through the existing statistics repositories and services (see API Contract, "Where the new figures come from").

## API Contract
All reads are under `/api/v1/me/players/{playerKey}/...`, in a new thin `MePlayerStatsController` (same base path as `MePlayersController`, kept separate so that one does not grow), delegating to `MyStatsService`, `MyTeamStatsService` and `MyLeaderboardService` (interface plus `Impl`, `@Transactional(readOnly = true)`, DTOs only). Every method starts with `MyPlayerAccess.resolve(authentication, playerKey)`: the club and the player come from the held player, never the request. **A key not held, malformed or dropped-out is 404; SUSPENDED is 403** (as `145`). A season, league or team that is not the club's is 404. `competition` other than `LEAGUE` or `FRIENDLY` is 400. All reads use `StatsScopeResolver.resolveForHeldPlayer` (`playerVisibleOnly = true`); no section reach applies.

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /{playerKey}/stats?seasonId=&leagueId=&teamId=&competition=` | held player | The one payload for the My stats page, `MyStatsDto` (below) |
| `GET /{playerKey}/stats/innings?kind=&filter=&seasonId=&leagueId=&teamId=&competition=&page=&size=` | held player | The match drill: the innings, spells or matches behind a tile, band or dismissal slice, `MyStatsInningsPageDto` |
| `GET /{playerKey}/team-stats?teamId=&seasonId=&leagueId=&competition=` | held player | The one payload for the Team stats page, `MyTeamStatsDto`. `teamId` is required and must be one of the held player's teams (a team in the player's `results/filters` options); any other team of the club is 404 |
| `GET /{playerKey}/leaderboards/{group}?sort=&direction=&seasonId=&leagueId=&teamId=&minimum=&page=&size=` | held player, club switch on | A standings table (`group` = `batting`, `bowling`, `fielding`), `MyLeaderboardTableDto` |
| `GET /{playerKey}/leaderboards/standing?seasonId=&leagueId=&teamId=` | held player, club switch on | The "Where Sam stands" card payload: the viewer's rank and sample in the headline columns |
| `GET /{playerKey}/leaderboards/awards?seasonId=&leagueId=&teamId=` | held player, club switch on | The Awards tab: category leaders for a season that has ended (Open question 2) |
| `GET /{playerKey}/leaderboards/filters` | held player, club switch on | The Season, League and Team options inside the leaderboard reach |
| `GET /api/v1/manage/clubs/{clubId}/hub-settings`, `PUT` the same | club administrator | `ClubHubSettingsDto { leaderboardsEnabled }` |
| `GET /api/v1/me/players/{playerKey}` (existing, additive) | held player | Gains `clubSwitches { leaderboards }` (the `121` slot), so `hubNav` and the page know whether to show Leaderboards |

**No new filters endpoint for My stats and Team stats.** They use the existing `GET .../results/filters` (the same flagged-only rule, the same season/league/team combinations), so Results and Stats cannot offer different options. Only Leaderboards needs its own filters read, because its reach (below) is wider.

**Club switch off.** The four `leaderboards/*` reads answer 404 ("Leaderboards are not shared by this club"), as a missing resource, not 403, so nothing about the club's data leaks. `GET /{playerKey}/stats` then returns `standing: null` and `teamFieldingRank: null` (the only two ranking fields of My stats) so cards can render without them.

### `MyStatsDto` (the My stats payload; names illustrative, exact keys pinned by the exact-JSON test)
One response, all cards read from it. Everything is the held player's own, in scope.
| Block | Content | Source |
|---|---|---|
| `scope`, `playerFirstName`, `ageBand` | echoed filters; `ageBand` (`ADULT`, `UNDER_13`, `AGE_13_17`, `UNKNOWN`) | `PlayerStatsDto.scope`; player profile |
| `basis` | `resultsCounted` (**M**), `resultsWithBattingCard`, `resultsWithBowlingCard`, `resultsWithFieldingCard`, `fixturesRemaining` (upcoming matches of the player's teams in the season, null when no season) | `PlayerStatsDto.basis`; the matches read |
| `batting`, `bowling`, `fielding`, `awards`, `record`, `form`, `notCaptured` | exactly `PlayerStatsDto`'s blocks (counters, derived figures, coverage, dismissal modes, positions) | `PlayerStatsService.getForHeldPlayer` |
| `series` | `battingInnings[]`, `dismissals[]`, `battingTrend[]`, `bowlingMatches[]`, `wicketTypes`, `economySummary` exactly as `PlayerDashboardDto` | the held-player variant of `PlayerDashboardService` |
| `rolling` | the rolling last-5-innings average per innings and the trend hint (`recent`, `earlier`, `direction`) | new in `PlayerStatsCalculator` / `StatsTrend` |
| `guides` | `{ low, high, basis }`, the graph guide values (see UI, "Innings by innings") | new in `PlayerStatsCalculator` |
| `bands` | scores in `0-9`, `10-29`, `30-49`, `50+` (count and share) and, per band, the drill filter token | new in `PlayerStatsCalculator` |
| `byInningsNumber` | batting first (innings 1) and chasing (innings 2): innings, runs, not outs, average | new fact + calculator |
| `byOpposition[]` | per opponent name as recorded: the player's scores in date order, runs | new fact + calculator |
| `dismissedBy[]` | the bowlers who dismissed the player: bowler name as recorded and count; a `notRecorded` remainder | new fact + calculator (PARTLY) |
| `wicketsByPosition` | batters the player dismissed grouped `OPENERS` (1-2), `MIDDLE` (3-6), `TAIL` (7-11), plus `notRecorded`; `caughtBy[]` (our fielders, full name, count) | new fact + calculator (PARTLY) |
| `milestones` | the next round number for runs, wickets and catches in scope (progress, to go) and `personalBests` (highest score, best bowling, most catches in a match, best strike rate with a named minimum balls), each with its match id | new in `PlayerStatsCalculator` |
| `teamRecordWhenScoring` | the team's record in matches where the player scored 30 or more, and where he did not | new fact + calculator |
| `homeAway` | innings, runs and average at the club's own fields versus elsewhere, plus `unknownFieldMatches` (PARTLY) | new fact + calculator |
| `bySeason[]` | per season (the Season filter is ignored for this block, the other filters apply): matches, runs, average, wickets | the same counters per season |
| `availability` | polls answered of total, answered "available" count, matches selected, matches played | existing availability and selection reads, scoped to the player |
| `teamFielding` | the player's team(s) catches, run-outs and stumpings for the scope, and `teamFieldingRank` (null when the switch is off) | `TeamStatsCalculator`; ranking only with the switch |
| `standing` | the player's rank among the batters of the league (null unless the scope is one league and the switch is on) | `LeaderboardTableRanker` |

Any figure above that the calculators lack **is added to the calculator and unit tested there** (as `117` did for the dot percentage), never written in a builder, a mapper or the client. The new fact queries are further methods on the existing statistics repositories, under the shared `PUBLISHED`, `PLAYED_RESULT` and `playerVisibleOnly` predicates, reached only through the statistics services (the existing ArchUnit rule stands unchanged; if `MyStatsServiceImpl` is not on the allow-list it reaches them through `PlayerStatsService`, which is the intended route).

### `MyTeamStatsDto`
`TeamStatsDto` (record, form, batting, chasing, bowling, extras, net run rate, basis, `notCaptured`) and the `TeamDashboardDto` series for the chosen team, plus: `contribution` (runs by player: top five by name with share, then Others and Extras; wickets by bowler the same way; names are full names, guests grouped as "Guests"), `battingFirst` and `chasing` (played, won), `tossWon` (won of known, PARTLY when the toss is not captured), `headToHead[]` (per opponent name: results in date order), `squad` (`playersUsed`, `averageAvailable` from the polls, PARTLY) and `closeGames` (played, won; "close" = decided by fewer than `CLOSE_RUNS` runs or `CLOSE_WICKETS` wickets, named constants in `TeamStatsCalculator`, defaults 20 and 2, Open question 9). The team SQL gains the same `playerVisibleOnly` predicate the player SQL has; the manager reads pass false and are unchanged (the `116` tests pass unchanged). The team page takes no `sectionId`.

### `MyLeaderboardTableDto`
`LeaderboardTableDto` as built (`103` decisions 26 to 31: columns from the catalogue, `sort`, `minimum`, `basis`, `page`, `rows[]` with rank, names, `teamName`, `smallSample`, `values`) with these Hub changes: each column carries `more` (true for the columns folded behind the "More" toggle, a server constant: batting Balls, SR, Outs and 100+; bowling Mdn, Dots, SR, 4W and 5W; fielding none), each row carries `mine` (true for the held player's row), and the response carries `me` (the held player's row and rank even when not on the returned page, null when the player has no figure in scope) so "Jump to Sam" works across pages. **Reach (default, Open question 1):** the players counted are those with a flagged, counted appearance in a league that one of the held player's teams played in during the chosen season (friendlies are outside the reach). The reach is a Hub-only optional restriction on `StatsScope` (league ids), honoured by one predicate in the aggregate SQL; manager reads pass null and are unchanged. Names are full names (Decision 3). Ranking uses the existing bounded server-side ranker and its 5,000-player guard; the page is sliced on the server.

### `MyStatsInningsPageDto` (the drill)
`kind` is `BATTING`, `BOWLING`, `FIELDING` or `MATCHES`; `filter` is optional and one of a fixed set that the payload itself advertises beside each drillable figure (`BAND_0_9`, `BAND_10_29`, `BAND_30_49`, `BAND_50_PLUS`, `FIRST_INNINGS`, `SECOND_INNINGS`, `NOT_OUT`, `OUT_BOWLED`, `OUT_CAUGHT`, and so on, `SCORED_30_PLUS`), so the client builds no query of its own; an unknown value is 400. Each row: `matchId`, date, opponent name, our team, the result from the player's side, and the figures of that innings, spell or match with every derived value (strike rate, economy) already computed. The set is bounded by one player, so the service reads the player's rows up to the existing `DashboardLimits.HISTORY_CAP` (300, `truncated` says so), applies a pure `StatsDrillFilter` in `service.support` and slices the page on the server; the browser never slices. This is the same bounded-by-one-player reasoning as `115` and `117`, not the leaderboard ranking exception.

### Rules for every read
- **Flagged results only.** Draft, unpublished and flag-off results are absent from every read, including team figures and other players' leaderboard figures. A result with the flag off is not countable by any route.
- **Parity.** Every figure on these reads is the calculator's output for the same scope; sums agree with the Results page (Testing, below).
- **Fixed statement count per request**, pinned by a query-count test; no N+1.
- **Names.** Full names appear only for the held player's own teammates, opposition players as recorded and leaderboard rows (inside the Hub, Decision 3); a name is never logged or put in an exception message.
- **No export endpoint** exists or is added; no stats path exists outside `/api/v1/me/players/**` for the Hub.
- `openapi.yaml` is updated by hand, additions only; the contract check is run. No new exception type.

## UI Requirements

### 1. Pages, routes and navigation
Three pages in `ui/src/pages/view/myPlayers/stats/`, replacing the Soon panels in `MyPlayerPage.tsx`: `HubMyStats` (`stats/mine`), `HubTeamStats` (`stats/teams`), `HubLeaderboards` (`stats/boards`). `hubNav.ts`: the three items lose `soon` and `soonCopy`; `defaultChild` then opens Stats on My stats (it already picks the first non-Soon child); `stats.boards` gets `visibleWhen: ctx => ctx.clubSwitches.leaderboards` (populated from the new `clubSwitches` field of the player read); the unit test still pins exactly seven main items and two levels. A direct link to `stats/boards` with the switch off shows a plain panel in `HubSoonPanel`'s frame: "Leaderboards are not shared by this club yet." (not "Soon"). Drill and result links add the origin to the address so `hubBack` returns to the same stats page and scope: `hubBack` gains a `stats` origin for `results/:matchId` ("Back to My Stats" or "Back to Team Stats", the stats scope query restored), as `145` did for Results; `hubBack.test.ts` gains the cases. The drill is a sub-view `stats/mine/innings?...` with its own header ("Runs" and so on) and footer Back to My Stats.

### 2. Page frame (page anatomy compliance, section 4 "Hub differs")
Every page follows the Results frame: the dark console, the page title and its controls in `HubPageHeader` (title left; right: the Season dropdown and a compact Filters button with a gold dot when something is chosen), no top-row Back (the footer Back), no kebab, no chevron, no Manage or Share menu, no "Showing N" text, Title Case labels, a link (not a button) when nothing exists, one tap target per card, the shared compact `Button` only (no raw MUI `Button`, `pageAnatomyGuard.test.ts` stays green), `CompactToggleGroup` for segmented switches, no lone control in its own row (group pills and toolbar controls share rows). The scope controls are **extracted from `HubResults.tsx` into a shared `HubScopeControls`** (Season select, Filters panel and sheet, chips, removable tags, the quiet single-league line, persistence) with no behaviour change, and Results is re-pointed at it first (its tests pass unchanged) so Stats reuses one implementation rather than copying 400 lines. Scope lives in the URL (`season`, `league`, `team`, `competition`) with a per-player fallback in `usePersistedListFilters` (`hubStats:filters:<playerKey>` for My stats and Team stats, `hubBoards:filters:<playerKey>` for Leaderboards). **Defaults (Open question 5):** My stats: the current season and all of the player's teams (the page is about one person); Team stats and Leaderboards: the current season and the player's current team (the team of the player's latest flagged result in the season, else the first active team). A saved value the player has no data for is dropped. Team stats needs one team: a player with several teams sees Team chips (only teams in the options); a one-team player sees a quiet line.

**Layout.** Under the header, the cards are in a responsive grid, `repeat(auto-fit, minmax(310px, 1fr))` (the Results rule: one card takes the width, two share it, never a lone card in a corner, no horizontal scroll). My stats and Team stats show each group as a headed section on tablet and desktop (Batting, Bowling, Fielding, Teammate; Record, Contribution, Matchups, Squad) in the registry's order, all visible; **on a phone a pill row (`HubPillStrip`) selects one group at a time** (`?group=`, default the first group with data), one card per row. A group with no card to show has no heading or pill. The page ends with one "Not captured yet" panel (below). Each card has a fixed face content but **no fixed pixel height**: the two faces share one grid cell so the card is as tall as its taller face and grows with 200 percent text zoom. Wide screens use the full console width (`145` Decision 16). Loading shows card-shaped skeletons of the same size (no layout jump); a failed read shows the Results-style error Alert with Retry; no flagged results shows "No stats yet" with the BrandIcon and one underlined link to Results; a filter that matches nothing shows "No matches for this filter" with Clear Filters.

### 3. The card contract and registry
```ts
type StatsPage = 'mine' | 'team' | 'boards'
type MineGroup = 'batting' | 'bowling' | 'fielding' | 'teammate'
type TeamGroup = 'record' | 'contribution' | 'matchups' | 'squad'
type BoardGroup = 'standing'
type DataTag = 'HAVE' | 'PARTLY' | 'NOT_CAPTURED'      // what the scorecard can support: a property of the card
type CardState = 'ready' | 'partial' | 'empty' | 'missing'   // what this scope actually has: computed at render

interface StatsCardDef<P> {                              // P is the page payload: MyStatsDto, MyTeamStatsDto, ...
  id: string                // stable, unique, 'mine.innings'
  page: StatsPage
  group: MineGroup | TeamGroup | BoardGroup
  title: (ctx: CardCtx) => string          // first name or team name, never "you"
  tag: DataTag
  needs: NeedsPath<P>[]                    // dotted payload paths the card reads (compile-time checked)
  order: number             // unique within its page; sorted by (group order, order)
  whenMissing: 'hide' | 'notCaptured'      // missing data: render nothing, or the Not captured yet state
  state: (payload: P, ctx: CardCtx) => CardState   // pure, reads only `needs`
  summary: (payload: P, ctx: CardCtx) => string    // one plain sentence: the accessible description of the card
  Front: FC<CardFaceProps<P>>              // headline
  Back: FC<CardFaceProps<P>>               // the story behind it; always includes a text alternative of any drawing
  drill?: (payload: P) => DrillTarget | null
  partialNote?: (payload: P, ctx: CardCtx) => string   // shown on a 'partial' card
}
```
- **Files.** Each card is one file in `stats/cards/<page>/` exporting its `StatsCardDef`; `stats/statsCardRegistry.ts` is the list of those exports (**one line to add a card**); `stats/statsCardGroups.ts` holds the group order per page (a new group is the one other permitted edit). `StatsCardGrid` reads the registry through `cardsFor(page)`; `HubMyStats`, `HubTeamStats` and `HubLeaderboards` import **no individual card**; `FlipCard` and `StatsCardShell` import no card and no Hub api module.
- **The shell** (`StatsCardShell`, Hub-local) draws what is common so a card file draws only its faces: the title row, the data-availability chip (HAVE green, PARTLY gold, NOT CAPTURED red; each carries the word, colour is never the only cue), the "Flip" hint, the scope label (so a screenshot is never misleading) and the honesty line **"Based on N of M results"** from `basis` and the card's coverage. `CardState` drives it: `ready` draws both faces; `partial` draws both faces, shows PARTLY and the card's `partialNote`; `empty` (the scope has no data for this card yet) draws a single non-flipping face with one line ("Not enough innings yet"); `missing` follows `whenMissing`: `hide` renders nothing, `notCaptured` renders the Not captured yet state (title, one line saying what the scorecard does not record, no figure, no zero). Cards that are `NOT_CAPTURED` by tag are kept in the registry as documented placeholders and are listed only in the page's closing **"Not captured yet" panel** (one panel per page, driven by the payload's `notCaptured` catalogue plus the placeholders), never as a flipping card.
- **Drill.** A tile, band or slice with a `drill` target is a real link to the drill sub-view (`kind`, `filter`, the scope); a graph point (a dot) is a real link to the Hub Result page for its `matchId`; a table row on a back face opens the Hub Result page. Links inside a face are in the tab order only while that face is showing.
- **Guards (tests, not memory).** A page imports no file under `stats/cards/`; `FlipCard`, `StatsCardShell` and `StatsCardGrid` import none; every `needs` path exists in the payload type and in the fixture; ids and orders are unique per page; every card has a `Front` and a `Back`; every drawing has a text alternative on the back; no file under `stats/` contains a hex literal (the `120` grep gate) or the words "you" or "your" in copy.

### 4. `FlipCard` (shared, `components/FlipCard`, four-file anatomy)
A generic, Hub-agnostic component: `front`, `back`, `label` (the card title), `flipped` and `defaultFlipped`, `onFlip`. Rules:
- **Tap to flip, on the whole card, with a real button.** The flip control is a real `<button>` stretched over the card (the `135` stretched-link pattern); interactive content in a face (a drill link, a dot) sits above it. Enter and Space (native button behaviour) flip it. It carries `aria-pressed` (true while the back shows), a stable accessible name ("Flip " plus the title) and a visible gold focus ring; the target is the whole card (44 px or more).
- **Both faces are readable without flipping.** Both faces are always in the DOM and the accessibility tree, in order (front, then back), each a labelled group ("Front", "Back"); the hidden face is hidden visually only (opacity and `pointer-events`), never `aria-hidden`, `display: none` or `visibility: hidden`. Controls on the face that is not showing are removed from the tab order (`tabIndex = -1` through a `FaceActive` context) but their text stays readable. The card's `summary` is its `aria-describedby`.
- **Motion.** A 3D rotation about the Y axis (about 0.7 s, compositor-only `transform`) with `backface-visibility: hidden`. Under `prefers-reduced-motion: reduce` (read live with `matchMedia`) there is **no rotation**: a 150 ms cross-fade between faces. Flip state is local to the card, resets when the scope changes, and is never stored.
- **Layout.** The faces share one grid cell; the card height is the taller face (no fixed height). The dark console styling uses `HUB` tokens and `brandTokens.ts`; no inline hex.

### 5. The first set of cards (the registry rows)
Front/back/source/tag; "source" is the payload block; tag is the card's `DataTag`. Order within a group is the order listed.

**My stats**
| id | Group | Title | Front | Back | Source | Tag |
|---|---|---|---|---|---|---|
| `mine.season` | Batting | Season in a card | Headline runs, innings, average, strike rate, highest score, the last-five form chips | Running average of the last five innings (line) with a sentence ("Last 5 average 61.4, up from 48.0 earlier") | `batting`, `form`, `rolling` | HAVE |
| `mine.innings` | Batting | Innings by innings | Line graph of runs per innings in date order, guide lines at the `guides` values, a running-average line, a hollow dot for not out, each dot a link to the match | The same as a table (date, opponent, runs, average after it) | `series.battingInnings`, `series.battingTrend`, `guides` | HAVE |
| `mine.dismissals` | Batting | How Sam gets out | Donut: not out, caught, bowled, LBW, run out, other | Who got Sam out: bowlers as recorded, with count and a "not recorded" remainder | `series.dismissals`, `dismissedBy` | HAVE (back PARTLY) |
| `mine.bands` | Batting | Scores in bands | Bars for 0-9, 10-29, 30-49, 50+, each bar a drill | Batting position and average at each position | `bands`, `batting.positions` | HAVE |
| `mine.innings-number` | Batting | First or chasing | Runs by innings number (batting first, chasing) | By opposition: the scores against each | `byInningsNumber`, `byOpposition` | HAVE |
| `mine.milestone` | Batting | Next milestone | Progress bars to the next round number for runs and wickets, "88 to go", matches left | Personal bests with their matches | `milestones`, `basis.fixturesRemaining` | HAVE |
| `mine.fires` | Batting | When Sam fires we win | The team record when Sam scores 30 or more, and when not | Where Sam stands among the league's batters, in the league's own average column (no percentages), only when the club switch is on | `teamRecordWhenScoring`, `standing` | HAVE (back PARTLY) |
| `mine.bowling` | Bowling | Bowling card | Wickets, best, economy, average, dot percentage | Innings-by-innings wickets bars with an economy line | `bowling`, `series.bowlingMatches`, `series.economySummary` | HAVE |
| `mine.wickets-how` | Bowling | How Sam takes wickets | Donut of bowler-credited dismissals: bowled, caught, caught and bowled, LBW, stumped, hit wicket (run-outs excluded) with a "Not itemised" slice | Batters dismissed by position (openers, middle, tail) and caught by our fielders | `series.wicketTypes`, `wicketsByPosition` | HAVE (back PARTLY) |
| `mine.fielding` | Fielding | In the field | Catches, stumpings, run-outs, per match | Team fielding totals; the player's rank in the team only when the club switch is on | `fielding`, `teamFielding` | HAVE |
| `mine.availability` | Teammate | Always there | Share of polls answered | Selected versus played; available count | `availability` | HAVE |
| `mine.homeaway` | Teammate | Home ground v away | Average at the club's fields versus away | Matches with no field recorded (the gap) | `homeAway` | PARTLY |
| `mine.seasons` | Teammate | Season by season | Bars of runs by season | The table of seasons | `bySeason` | HAVE |

**Team stats**
| id | Group | Title | Front | Back | Source | Tag |
|---|---|---|---|---|---|---|
| `team.season` | Record | Team season card | Won of played, win percentage, net run rate, run rate, highest total | Form chips and margins (biggest win, closest game) | `record`, `form`, `netRunRate`, `batting`, `chasing` | HAVE |
| `team.contribution` | Contribution | Where the runs come from | Bars of runs by player (top five, others, extras) | Where the wickets come from | `contribution` | HAVE |
| `team.first-chasing` | Matchups | Batting first v chasing | Won of played batting first and chasing; toss | Head to head by opponent | `battingFirst`, `chasing`, `tossWon`, `headToHead` | HAVE (toss PARTLY) |
| `team.squad` | Squad | Squad strength and close games | Players used; average available per match | Close games won (decided by fewer than 20 runs or 2 wickets) | `squad`, `closeGames` | HAVE (availability PARTLY) |

**Leaderboards**
| id | Group | Title | Front | Back | Source | Tag |
|---|---|---|---|---|---|---|
| `boards.standing` | Standing | Where Sam stands | The ordinal rank in runs, average, wickets, economy and catches within the reach, each with the number of players listed and the sample | The same as a table with the sample behind each rank and the minimum-qualifier note | `standing` | HAVE |

The Leaderboards tables themselves are not cards; they are the `103` tables (below).

**Rules the cards share**
- **Innings by innings guides.** The guide lines are `guides.low` and `guides.high`, computed on the server (so a card never hard-codes an age rule). Default **30 and 50** (the platform's 30+ and 50+ definitions, `103`). For juniors the guides scale to the age band: `UNDER_13` 15 and 30, `AGE_13_17` 20 and 40, `ADULT` and `UNKNOWN` (no date of birth, or no age data) 30 and 50. The age band uses the player's age on the date of the latest counted match in scope. The guides draw reference lines only; **they never change a counted figure** (the 30+, 50+, 100+ counters, the bands and "when Sam fires" keep their fixed definitions). The numbers for juniors are proposals (Open question 8).
- **Drawing rules.** All first-set drawings (line with guides, donut, bars, progress bars, the sparkline) are our own small SVG in a shared `components/StatsDrawings` folder (four-file anatomy, pure scale and path helpers extending `drawingMath.ts`), per `145` chart rule 2. Tones come from `brandTokens.ts` (win, loss, blue and gold exist for Results; any missing one is added as a named token). Each drawing has a text alternative; graph dots are real links with an accessible name ("47 not out against Rovers, 1 November"); a hollow dot also says "not out" in that name.
- **Honesty.** A figure built on optional columns (balls, fours, sixes, dots) uses the calculator's coverage and the card says "from N of M innings". A null is a dash or "Not recorded", never zero. The opponent and bowler names are shown as the manager recorded them (free text, so one bowler can appear spelled two ways).

### 6. Leaderboards page
- **Tabs** Batting, Bowling, Fielding, Awards (a `ViewTabsRow`, a pill row on a phone), `?tab=`. Batting, Bowling and Fielding are **tables, not cards** (`103` decision 26): fixed columns from the response, a **Sort by** select and tapping a column heading (a second tap reverses, `?sort=`, `?dir=`), competition ranks, the unranked group last, sample sizes in rate rows, an optional minimum that shows only on rate sorts, Show More from the server (`useInfiniteQuery`).
- **Toolbar** (one row, no lone control): Sort by, a "More Columns" toggle chip (folds the columns the response marks `more`: dot balls and strike rate among them; the sorted column is always shown), and the **Jump to Sam** link button, which scrolls the viewer's row into view (smooth scroll off under reduced motion) and moves focus to it; when the row is on another page it loads that page first (`me` tells it where). Filters: Season dropdown and Filters (League, Team) in the header.
- **The viewer's row** (`mine`) is highlighted in gold with a left bar, `aria-current="true"` and a screen-reader-only "This player" mark; the highlight never relies on colour alone.
- **Honest sample.** A line under the table states the sample ("Based on 31 results; balls recorded in 18 of 24 innings") and the minimum-qualifier note ("Players below the minimum are listed after the ranked players").
- **Awards tab.** Shows the category leaders only for a season that has ended; for the current season it shows "Awards are revealed when the season ends." (Open question 2).
- **Names.** Full names (Decision 3), only inside the Hub; the tables carry no Share, Copy or Download.
- **Phone.** The table scrolls sideways with the rank and player columns pinned; the "Where Sam stands" card is the first thing on the page.

### 7. No export (Decision 3)
Hub stats show other people's children by full name, so none of it may leave the screen. A guard test `hubStatsNoExport.test.ts` pins that no file under `stats/` and `components/FlipCard`, `components/StatsDrawings` imports `utils/share/**`, `jspdf`, a canvas-to-image helper, `WhatsAppSendActions` or `navigator.share`, contains a Share, Download or Copy control, or builds an `a[download]`. No stats route is reachable without sign-in. **Rule for any future share path:** it is a new spec; it may share only the held player's own first-name figures (never another person's name), must use `shareName` and the `isJuniorMatch` lock, must never include a leaderboard row, a teammate or an opposition name, and must be added to this guard deliberately, not by deleting it.

### 8. Accessibility
Flip: a real button, `aria-pressed`, Enter and Space, a visible focus ring, both faces readable without flipping, controls on the hidden face out of the tab order, reduced motion is a cross-fade (section 4). Every graph has a table on the back and a one-sentence summary. Tables are real `<table>`s with `scope="col"` headers, sortable headings are buttons with `aria-sort`. Targets are 44 px. Text scales to 200 percent (no clipping fixed heights). Contrast: gold, cream and each tag tone on the card ground are checked once at the token stage by a test over the tokens (as `PageCounters.test.tsx` and `146` do). Headings: each group is an `h2`, each card title an `h3`.

### 9. Components used
Existing: `HubFrame`, `HubPageHeader`, `HubPillStrip`, `HubSoonPanel` frame, `hubStyle.ts` (`HUB`), `brandTokens.ts`, `BrandIcon`, the shared compact `Button`, `CompactToggleGroup`, `BottomSheet` (the filters sheet), `FormStrip`-style chips (the `chipFigure` and result-tone helpers of `resultsFormat.ts`), `usePersistedListFilters`, `useMyPlayer`, `useMyPlayerResultsFilters`, `oversFormat`. New: `HubScopeControls` (extracted), `FlipCard`, `StatsCardShell`, `StatsCardGrid`, `components/StatsDrawings`, `statsCardRegistry.ts`, `statsCardGroups.ts`, `cards/**`, `statsFormat.ts` (formatting only, no figure), `api/meStatsApi.ts` (keys under `['me', 'players', key, 'stats' | 'team-stats' | 'leaderboards', ...]`; `useMyStats`, `useMyStatsInnings` (infinite), `useMyTeamStats`, `useMyLeaderboard` (infinite), `useMyStanding`, `useMyBoardsFilters`), and the manager-side switch (below). **No new dependency.**

### 10. The manager switch
A compact "Player Hub" card on the Club profile page (club administrators only, beside Share formats) with one labelled switch, "Show Leaderboards In The Player Hub", off by default, with a one-line explanation ("Parents and players see standings that include other players, children among them. Turn on only if your club is comfortable with that."). It reads and writes `hub-settings`. No other manager UI changes.

## Test Plan
Per `docs/standards/testing.md`. Following the owner's working rule, tests are written after the owner has checked the function; targeted runs per step, one full run at the end. Playwright is not run by this spec.

**Backend**
- **Unit (JUnit):** every new figure in `PlayerStatsCalculator` and `TeamStatsCalculator` (bands, rolling five-innings average, guides per age band, next milestone ladders, personal bests, by innings number, by opposition, dismissed-by and wickets-by-position remainders, team record when scoring 30, home and away split, close games, shares, contribution top-five and Others) including every null and zero-denominator case; `StatsDrillFilter` per filter token; `HubLeaderboardColumns` (the `more` set); the leaderboard reach predicate input.
- **Integration (Testcontainers, `AbstractIntegrationTest`):**
  - **Access:** key not held, malformed, dropped-out: 404; SUSPENDED: 403; another club's season, league or team: 404; a `teamId` that is not one of the player's teams: 404; leaderboards with the switch off: 404 on all four reads; `competition` bad value: 400; unknown drill `kind` or `filter`: 400.
  - **Flagged-only:** a published result with the flag off, a draft and an unpublished result are absent from `stats`, `stats/innings`, `team-stats` and the leaderboards (other players' figures too).
  - **Parity:** `MyStatsDto` batting, bowling, fielding, awards and record equal `PlayerStatsService.getForHeldPlayer` for the same scope; `basis.resultsCounted` and the Σ runs, wickets and catches equal the Results summary for the same scope (`145`); series sums equal the tiles (`117` targets); the drill rows sum to the figure they came from; team figures equal `TeamStatsService` for a scope where every result is flagged, and contribution runs plus extras equal the team's runs; a leaderboard row equals the same player's `MyStatsDto` figure for the same scope (the `103` parity rule extended); `bySeason` rows equal the stats for that season.
  - **Exact JSON keys** for every new DTO (as `135` and `145`), including that no internal id other than the match id and the scope ids leaves.
  - **Query count** pinned for `stats`, `stats/innings`, `team-stats` and a leaderboard page.
  - **Migration `063`** applies on a clean database and a database with `062`; the default is false; `hub-settings` read and write; the club profile `PUT` does not reset it.
  - Manager reads are unchanged: the `103`, `115`, `116` and `117` suites pass untouched (the new flags default to "not Hub").
- **Contract:** the hand-maintained `openapi.yaml` additions pass the contract diff; no stats path outside `/api/v1/me/players/**` for the Hub.
- **ArchUnit:** the rule set is unchanged; the existing statistics-repository and layering rules must hold with the new classes.

**Frontend (Vitest and Testing Library)**
- **Unit:** the registry (unique ids and orders, every card has Front and Back, every `needs` path exists in the payload type and the fixture, tags valid, no hex, no "you"/"your" in copy); `cardsFor(page)` ordering and group hiding; `state()` of each first-set card on full, partial, empty and missing fixtures; `statsFormat` (dashes, "N of M", signed values, ordinal ranks); the scope helpers; `hubNav` (stats items live, Leaderboards `visibleWhen`, seven items and two levels pinned); `hubBack` stats origin cases.
- **Guards:** a page imports no card; `FlipCard`, `StatsCardShell`, `StatsCardGrid` import no card and no Hub api module; `hubStatsNoExport.test.ts`; `pageAnatomyGuard.test.ts` stays green; contrast over the tone tokens.
- **Component:** `FlipCard` (button role, Enter and Space flip, `aria-pressed`, both faces in the accessibility tree, hidden-face controls `tabIndex -1`, reduced motion uses a fade and no rotation, state resets on scope change); `StatsCardShell` (tag chip, "Based on N of M results", partial note, empty and missing states); each card family renders from a fixture and drills (a tile link target, a dot link to the Hub Result page, a row link); the three pages (loading, error with Retry, empty, filtered-empty, partial, full; Season and Filters change the request and the URL; phone pill row shows one group; wide shows all groups); the drill sub-view (Show More appends from the server, Back restores the scope); Leaderboards (Sort by, heading tap and reverse, More Columns, own row highlighted and `aria-current`, Jump to, minimum note, Awards before and after the season ends, switch-off panel); `HubResults` behaves unchanged after the `HubScopeControls` extraction.
- **Storybook:** `FlipCard` stories (front, back, flipped, reduced motion, long content, 200 percent text); `StatsDrawings` stories; one story per card family (batting, bowling, fielding, teammate, team, standing) in ready, partial, empty and not-captured states at 375, 768 and 1280; a "future card" story with a synthetic card registered in the story registry to prove the contract needs no grid change.
- **Manual (owner):** the 375 px sweep, a keyboard pass (tab order, flip, drill), a screen reader pass of both faces, reduced motion, 200 percent zoom, a real club with flagged results across two teams and a junior.

## Acceptance Criteria
1. Stats, My stats, Team stats and Leaderboards are no longer Soon panels; My stats and Team stats are live for every held player, and Leaderboards is live only when the club switch is on.
2. Every first-set card flips on tap, by Enter or Space, and shows the headline on the front and the story on the back; reduced motion gives a fade, not a rotation.
3. Both faces of every card are readable by a screen reader without flipping; the flip control is a real button with `aria-pressed`; controls on the hidden face are not in the tab order.
4. Adding a card is one new file plus one line in `statsCardRegistry.ts`; the story with a synthetic card and the guard tests prove the page, grid, `FlipCard` and the endpoint need no edit.
5. Each page makes one stats request (plus the drill when opened, and the shared filters read); no card issues its own request.
6. A result with Show In Player Hub off, a draft and an unpublished result appear in no figure, drill row, team figure or leaderboard row; My stats sums equal the Results page for the same scope.
7. Every figure equals the manager figure for the same scope; no counting rule exists outside `PlayerStatsCalculator`, `TeamStatsCalculator` and their builders; the client computes no figure.
8. Every card shows "Based on N of M results"; PARTLY cards say what is partial; a missing figure is a dash or "Not recorded", never zero; a card with no data shows "Not captured yet" or nothing, as its definition says.
9. The innings graph shows a line of runs per innings in date order with guide lines at 30 and 50 (15 and 30 for under-13s, 20 and 40 for 13 to 17), a running-average line and hollow dots for not outs; tapping a dot opens that Hub Result page; the back is a table.
10. A tile or a band opens the innings behind it, and a row opens the Hub Result page; Back returns to the same stats page and scope.
11. The Season dropdown and Filters (League, Team) work as on Results, are remembered per player, and Team stats shows only the player's own teams (any other team is 404).
12. With the club switch off there is no ranking of any player anywhere in the Hub's stats, the Leaderboards item is hidden, and its direct link says leaderboards are not shared; with it on, the tables, the highlighted own row, Jump to, Sort by, More Columns, sample sizes and the minimum note work, with the "Where Sam stands" card first.
13. No copy says "you" or "your"; the player is named by first name ("This Player" as the fallback).
14. No export, share, download or public path exists for Hub stats, and the guard test fails if one is added.
15. No worm chart, phase split, wagon wheel or partnership card exists; they are listed under Not captured yet.
16. The only migration is `063`; `openapi.yaml` additions pass the contract check; ArchUnit rules are unchanged; the manager stats suites pass untouched.
17. A club administrator can switch Player Hub leaderboards on and off, default off.

## Open questions (short, defaults apply)
1. **Leaderboard reach.** Default: players with a flagged result in a league one of the held player's teams played in that season. Alternative: club-wide. Reason for the default: a parent compares within the competition the child plays in, and it exposes fewer other children.
2. **Awards to players.** Default: the Awards tab shows category leaders only for a season that has ended; during the season it says awards are revealed when it ends. Reason: it protects the presentation evening with no extra setting. Alternative: always live, or never shown.
3. **Availability and selection card on the player's own page.** Default: shown ("Always there"), it is the player's own data and a reliable-teammate signal parents like. Alternative: managers only.
4. **Percentile rankings ("top 12 percent").** Default: not built. If built later, hidden for `UNDER_13` and `UNKNOWN` ages, because a percentage that sounds like a grade can sting a young child; ordinal ranks appear only on Leaderboards and the standing card, behind the club switch.
5. **Default scope.** Default: My stats current season and all teams; Team stats and Leaderboards current season and the player's current team. Alternative: current team on My stats too.
6. **Columns hidden from parents.** Default: the same columns as the manager tables, with dot balls and strike rate (and balls, outs, maidens and the 100+ and 4W/5W counters) behind a "More Columns" toggle. Alternative: drop them for the Hub.
7. **The club switch and its default.** Default: built, off, club administrators only (`121`'s rule, Decision 10). Alternative: no switch and leaderboards on for every club (the owner's call; it would delete migration `063` and the manager card but removes the safeguarding control).
8. **Junior guide values.** Default: 15 and 30 under 13, 20 and 40 for 13 to 17. These are proposals for the owner to correct; they affect only the graph guide lines.
9. **Close-game constants.** Default: fewer than 20 runs or 2 wickets, as the round 2 mockup. Alternative: a percentage of the target.
10. **Links from Results to Stats.** Default: none in this spec (Results is unchanged). Alternative: the Recent Form card gets an "Open My Stats" link, as `145`'s open question 8 anticipated.
11. **Ranking inside the team.** Default: "second for catches in the team" appears on the fielding card back only when the club switch is on (it is a ranking). Alternative: remove it.

## Rollout Notes
- **Order (one branch, slices checked by the owner in the browser; tests after the owner's function check, then a standards review, one full suite at the end):**
  1. Foundations, no cards: extract `HubScopeControls` (Results re-pointed, its tests unchanged), `FlipCard` and its stories, `StatsCardShell`, `StatsCardGrid`, `statsCardRegistry.ts`, `statsCardGroups.ts`, `components/StatsDrawings`, the guards, `api/meStatsApi.ts` shapes.
  2. Backend My stats (calculator additions, new facts, `stats`, `stats/innings`, the drill filter) and the My stats page with the batting cards, then bowling, fielding and teammate cards.
  3. Backend and page for Team stats (including the Hub predicate on the team SQL).
  4. Migration `063`, `hub-settings` and the manager card, the leaderboard reach, tables, standing and awards, the Leaderboards page, `clubSwitches` on the player read.
  5. Docs and `hubNav` flips.
  Each slice can ship behind the Soon panels not being replaced until its page is complete (the nav item stays Soon until its page is built).
- **Docs updated in the same change:** `docs/standards/design-system.md` (a "Player Hub stats" section: flip card, shell, data tag chips, drawings, registry, guides rule), `docs/standards/frontend.md` (the registry rule: pages import no card; the one-payload rule; the no-export rule and guard; `HubScopeControls`), `docs/standards/backend.md` (the Hub reads of `103`, `116`, `117` rules: flagged-only on team SQL, the leaderboard reach, the drill cap), `docs/roadmap.md` (row `147`, the future cards below, and the forward items), `docs/specs/121` (My stats, Team stats and Leaderboards no longer Soon; the Rollout table row for Leaderboards now points here with the switch built), `docs/specs/103` (the player-facing note: players now read their own stats and, behind the club switch, the standings, via `147`, the "manager-only" wording of decisions 6 and 13 amended), `docs/specs/145` (its "Stats screens stay Soon" non-goal is now fulfilled by this spec), `docs/standards/page-anatomy.md` (the review log row "Player Hub: Stats"), and `docs/architecture.md` only if its Hub diagram lists the reads.
- **No feature flag** beyond the club switch for Leaderboards; the Soon panels are replaced page by page.
- **The catalogue of figures the scorecard cannot yet provide is `docs/specs/147-not-captured.md`** (Amendment 2 item 11: no page panel any more).
- **Future cards (not in this spec) and what each needs first** (each becomes one file plus one registry line once its data exists; until then it is a "Not captured yet" placeholder in the closing panel):

| Card idea | What it needs first |
|---|---|
| Worm chart and run rate by phase (powerplay, middle, death) | Ball-by-ball or per-over capture (a scorer app or a per-over entry step); `103` Deferred "scorecard capture" spec |
| Partnerships (runs by wicket) | Fall-of-wickets and partnership capture (both batters and runs at each wicket) |
| Wagon wheel and scoring zones | Shot direction per scoring shot; ball-by-ball capture |
| Boundaries conceded (bowler) | Per-bowler fours and sixes conceded (`bowling_entry` columns) or ball-by-ball |
| Batter dot-ball percentage | `batting_entry.dots` (as `bowling_entry.dots` was added in `045`) or ball-by-ball |
| Wicketkeeper dismissals (caught behind) | A wicketkeeper marker per match on the scorecard (`101` dropped it) |
| Dropped catches, direct hits, run-out assists | Capture of those events per fielder |
| League position and points table | A points-table read for the league (`122`/`123` left standings out); then a Team stats card |
| Player of the match awards card | Nothing new in the data (`awards` exist); a card file only; held back from this set by the owner's list |
| Percentile rankings | The Open question 4 decision, age handling, and the club switch |
| Share a card as an image | A new spec obeying the rule in UI section 7 (first-name, own figures only, `shareName`, junior lock) |

## Addendum (owner, 2026-11-07, after the spec was drafted)
- **Two more first-set cards, from the mockups** (`player-hub-stats-round2-mockup.html`): **Extras** (team page: extras the team gave away and received with the breakdown of wides, no-balls, byes and leg byes, share of runs conceded, back = extras by match; data from the `match_innings` extras breakdown, tagged PARTLY because summary-level results record no breakdown) and **Bowling discipline** (player page, Bowling group: wides and no-balls the bowler gave away and per over, back = by innings; byes and leg byes are not charged to a bowler). Both are plain registry entries; nothing else in the spec changes.
- **One card system for the Hub and the manager app.** The owner wants the manager Team and Player stats pages rethought on the same flip cards (`manager-stats-cards-round1-mockup.html`: the flip replaces "View As Table", a manager-only Squad group). This spec still builds the Hub pages only, but the card contract, `StatsCardShell`, the flip component and `StatsDrawings` are to be built in a shared location (not under `pages/view/myPlayers/`) so the manager spec can reuse them without moving code; the manager spec is a separate, later spec that adds its own registry of pages and the manager-only cards.

## Amendment 2 (owner review of the built My stats page, 2026-11-07; supersedes the spec where they differ)
1. **Menu name.** The Stats item `stats.mine` is labelled **Player Stats** (the manager view shows it too); `stats.teams` stays Team Stats, `stats.boards` Leaderboards.
2. **Groups are pills on every width.** The group selector (Summary, Batting, Bowling, Fielding, Teammate) is the pill row on desktop as on a phone; one group shows at a time, never one long scrolling page of all groups.
3. **A Summary group comes first** (new `summary` payload block): Leagues Played, Teams Represented, Matches Played, Runs Scored, Balls Faced, Overs Bowled (balls), Catches Taken. The **Leagues Played** card flips to a horizontal bar of matches played per league; **Teams Represented** flips the same per team; the other summary cards flip to a short story (to be agreed card by card).
4. **Batting card clarity.** The batting card states innings played and times dismissed clearly (innings, not outs, dismissals).
5. **Where the batter bats is its own flipping card:** positions 1 and 2 are classed **Opener**, then positions 3 to 11 each, runs scored in each as a bar graph, with the table on the flip (the table as built). Grouping is computed on the server (`battingPositionGroups`).
6. **Home and away runs belong to the batting card**; its flip (or one more card) shows **runs at each venue** (`battingVenues`). **Bowling gets the same**: wickets and economy home and away and per venue (`bowlingHomeAway`, `bowlingVenues`).
7. **"When <player> fires we win"** is on hold for discussion; it stays registered but hidden from the page until the owner decides.
8. **No HAVE/PARTLY/NOT CAPTURED badge on cards.** A card with some or all data missing gets a slight colour change instead (a quiet tint; the honesty line and partial note stay). The data-tag stays in the registry as metadata.
9. **Expand on desktop.** Each card has an expand button (desktop only): the card takes the whole available area of the view with a visible Close; Escape closes; focus returns to the card.
10. **Even rows.** Cards no longer differ in height per row: each group lays out as rows of **three equal-height cards**, or **one tall card beside two vertically stacked cards**, set per card in the registry (a `size` of `normal` or `tall`). No ragged rows.
11. **No 'Not captured yet' panel in the UI.** The catalogue of figures the scorecard cannot yet provide is documented in `docs/specs/147-not-captured.md` instead (a doc, not a page element). `payload.notCaptured` stays in the API.
12. **Order of work:** Player Stats is completed first; Team stats and Leaderboards changes follow. No tests until the owner says.

