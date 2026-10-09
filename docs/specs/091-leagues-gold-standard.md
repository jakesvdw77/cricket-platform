# 091 — Leagues Gold Standard: Page, Card, List View, League Page, Edit Form

**Depends on:** 029 (league management), 050 and 051 (schedule, sharing), 052 and 055 (playing conditions, season config), 053 (extended profile), 054 (contacts), 062 and 072 (league page and its three views), 070 (league teams), 071 (league card), 081 (page counters), 087–090 (the Matches, Players and Polls gold standards: `FilterBar`, `ContentControlsLine`, `PageCounters`, `ListViewToggle`, `useListViewPreference`, `HeaderSeasonSelect`, `KeyFigureTile`, `SelectionGauge`, `CompactToggleGroup`, `MatchTable`-style tables, the "Record detail page" and "Compact forms" paragraphs in `docs/standards/design-system.md`)
**Status:** draft — written 2026-10-09 from the user's request ("make the full set of gold standards for Leagues: Card, Dashboard, Toolbar, View Page all 3 tabs, toolbar, season filter, the works"). Decided by the user: counters **Active, Players, Teams, Seasons, Matches this week** plus one more (Need attention, suggested), a **Season pill** that picks the season the cards show (backend support), the **add / edit league form**, a **Cards | List view**, and **Edit is the filled primary button on every detail page**. Mockup canvas (https://claude.ai/artifact/B51nNZYzbcTFHDmhN2qK4D: Leagues page desktop and phone, list view, the league page's Schedule, Teams and Conditions tabs, the league page on a phone, the Edit league form) **approved by the user on 2026-10-09** after changes (equal-height cards on the Teams and Conditions tabs, social links restored on the card and the header, the card keeps every team with no "+N"); the spec text has not been reviewed line by line. **Built** on branch `feat/091-leagues-gold-standard` (plan: `docs/plans/091-leagues-gold-standard.md`); awaiting the user's browser check, which needs the backend restarted (no migration). Readings: Need attention counts active leagues with no teams or no matches; Matches this week is the Matches counter's window (start of today for 7 days); the Format filter and search stay client-side, so the counters follow only the season and Show inactive; the matches and Share schedule dialog moved into `LeagueViewLayout` (the header button works on every tab); `PlayerInfoCard` became the shared `InfoCard`; `NextMatchCountdown` and `leagueViewParts` were removed as unused.

## Problem & Goals

Leagues is the last big area still on the pre-gold-standard look: the list has only a Format filter and a search in the old `ListToolbar`, no counters, no list view and no season control (cards always show the club's "current" season); the card is a long stack of detail lines; the league page has a thin header with a Season dropdown, badges and a tinted Edit button; its three tabs (Schedule, Teams, Conditions) are single bordered cards with no toolbar; and the edit form hides its basics behind inner tabs.

Goals:
- **A. Leagues page:** header with a Season pill, counters (quick filters), the shared toolbar and content line, a Cards | List switch.
- **B. League card:** the redesigned card (next-match strip, played gauge, every team, social icons).
- **C. League page:** the poll-page header, a key-figure strip, and the three tabs brought to the standard (Schedule toolbar and zebra fixtures, Teams, Conditions).
- **D. Add / Edit league form:** one compact card with sections instead of inner tabs.
- **E. Edit is always the filled primary button** on every detail page.

## Non-goals

- No change to what a league, a league team, a season or the playing conditions *are*, their permissions, or the share outputs (PDF, poster, calendar).
- The Teams, Schedule, Playing conditions and Contacts tabs of the **edit** form keep their content; they pick up the compact spacing only (D shows the Details tab).
- No results or scores (no data source exists); no new league fields.

## User Stories

- As a manager, I can see at a glance how many leagues are active, how many teams and players are entered, and which leagues need attention, so that I know where to look.
- As a manager, I can pick a season once and see every league card (teams, matches played, next match) for that season.
- As a manager, I can switch Leagues between Cards and List and have the app remember my choice.
- As a manager, I can open a league and see its key figures, then filter its fixtures by team, my own matches and played matches, so that I find a match quickly.
- As a manager, I can edit a league's basics, contact details, logo and social links on one screen.

## Data Model Changes

None. All figures are computed from existing data (affiliations, league teams, matches, seasons, squads).

## Leagues page (A)

Mockup boards 1–3.

- **Header:** the title "Leagues", the **Season pill** (`HeaderSeasonSelect`, spec 089 D) beside it and **Add league** (filled) on the right. The pill lists the club's seasons (no "All seasons": a league card is always for one season) and defaults to the season containing today, else the most recent (`pickDefaultSeasonId`); the choice is remembered with the other persisted filters. It decides the season every card, counter and the list shows.
- **Counters** (`PageCounters`, compact): **Active leagues** (quick filter: not retired), **Teams entered** (figure: the club's own teams entered in the chosen season, across the shown leagues, plus the league teams), **Players** (figure: distinct players in the squads of the club's own entered teams that season), **Seasons** (figure: the club's seasons), **Matches this week** (the matches in the next 7 days across the shown leagues; clicking it keeps only the leagues that have one), **Need attention** (amber quick filter: a league with no teams entered or no matches scheduled in the season; zero shows a plain card). Quick filters are mutually exclusive and clicking the active one again clears it. Teams entered, Players and Seasons are plain figures. Matches this week is deliberately a count of matches while its filter keeps leagues (a stated exception to the "counter equals list size" rule).
- **Toolbar:** `FilterBar` (compact) with Format and search; content line "Showing N leagues" with the sort link (Name, A to Z / Z to A), **Show inactive** (inactive leagues are hidden by default) and the **Cards | List** switch (`useListViewPreference('leagueList:view')`; first control in the Filters sheet on a phone).
- **Cards:** the grid of B; **List:** a `LeagueTable` (zebra, sticky header, whole row opens the league's Schedule): League (logo, name), Format, Teams, Next match (date, countdown, amber within 24 hours), Matches played (bar and "12 of 56"), Status; phone: League, Played ("12/56"), chevron.

## League card (B)

Mockup boards 1 and 2. One `RecordCard`, the whole card opens the Schedule:
- **Header:** logo tile, name (wraps), badges under it: **format** and **Active / Inactive** (the team count and the season label chips go: the Teams block and the Season pill carry them); the website and social icon buttons in the top-right corner (only when the league has them).
- **Next match strip** (`CardTimeStrip`, as the match card): the date and time and a countdown chip, amber within 24 hours; "No matches scheduled yet" (dashed) when there is none.
- **Matches played gauge:** "Matches played  12 of 56" with the `SelectionGauge` look ("● 12 Played ● 44 To go").
- **Teams block:** "Teams · 8 in this season" and **every team** as a wrapping row of avatars with their short name under them (own teams solid, league teams tinted, full name as the tooltip); "No teams registered for this season" when none. No cap and no "+N".
- **Footer:** Schedule, Teams, Conditions, Edit (icon over caption), as today. First match, last match, Playing XI and Age range move to the league page.

## League page (C)

Mockup boards 4–7. Header as the poll page and the match page (`docs/standards/design-system.md`, "Record detail page"):
- **Top row:** Back on the left; on the right the **Season pill** (replacing the Season dropdown; `?seasonId=` stays in the address and is carried from the list), **Share schedule** (outlined) and the filled **Edit**.
- **Title row:** logo tile (64 px) and name at the page-title size; under it the **format** and **Active / Inactive** badges (the team-count badge goes).
- **Contacts and links line:** the league contacts (avatar buttons opening the quick-view dialog), phone, email, website and the social icons, on one line (wrapping on a phone).
- **Key-figure strip** (`KeyFigureTile`, four across, two on a phone): **Teams** (in the season), **Matches played** ("12 of 56"), **Next match** (date, time, countdown, amber within 24 hours), **Playing XI** (with the age range as the caption).
- **Tabs** (Schedule, Teams, Conditions; link navigation as today, `aria-current`), each tab with its own toolbar line:
  - **Schedule:** a compact toolbar (Team select with the season's teams, search by team or venue), the content line "Showing 44 upcoming matches · 2026/2027" with **Only our matches** and **Show played** switches, and a zebra fixtures table (When, Match with a logo beside each team, Venue, an "Our match" chip, a chevron that opens our matches). The next-match countdown moves into the strip above. Filters are client-side over the league's season matches (already fetched whole).
  - **Teams:** a search and an **All | Our teams | League teams** `CompactToggleGroup`, then "Our teams · n" and "League teams · n" cards, **equal height**, with icon-tile headings and two-across team tiles (name in full; own teams link to the team, league teams do not).
  - **Conditions:** the tab line with **Conditions PDF** and **Share**; icon-tile cards **Innings** (max overs, powerplay, per bowler with "(auto)", substitutions), **Points** (win, loss, draw, no result, forfeit win and loss) and **Fielding restrictions** (notes), the two top cards **equal height**; "No playing conditions set for this season yet" when none.
- **Phone:** Edit on the Back row, Season pill and Share schedule as halves, the strip two across, the tabs, a Filters sheet for the Schedule toolbar.

## Add / Edit league form (D)

Mockup board 8. The Details tab becomes one card with icon-tile section headings: **Basic info** (Name, Format, Playing XI size, Min age, Max age, Age cutoff date; three columns, one on a phone), **Contact** (Phone, Email, Website) and **Branding and social** (logo upload and the social links) instead of the inner Basic Info / Branding / Social Media tabs; "(optional)" in labels, no helper text, footer with the Active switch (edit), **Cancel** and **Save changes** / **Create league**. Same fields, validation and payload. The outer tabs (Details, Teams, Schedule, Playing Conditions, Contacts) stay with the compact spacing. Add League is the same card without the outer tabs.

## Edit button everywhere (E)

On every detail page **Edit is the filled primary button** (`variant="contained"`): the league page (C), `TeamDetailPage`, `ClubOverviewPage` and the shared `RecordDetailScreen` (Season, Sponsor, contacts and every other detail built on it) lose the tinted style. Player and match pages already comply.

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/leagues?seasonId&includeInactive&focus` | existing club access | Gains optional `seasonId` (the season the computed fields describe; default the current season, as today; a season of another club is a 404/400 as elsewhere), `includeInactive` (default `true`, so existing callers are unchanged; the page sends `false`) and `focus` (`active`, `this-week` or `attention`, anything else 400; combines with the others). `LeagueDto` fields are unchanged (they already carry team count, label, match counts, first / last / next match and the team list); `currentSeason*` then mean "the chosen season". |
| `GET /api/v1/manage/clubs/{clubId}/leagues/summary?seasonId&includeInactive` | same | `LeaguesSummaryDto { leaguesShown, active, teamsEntered, players, seasons, matchesThisWeek, needAttention }`, computed from the same filters as the list so each quick-filter figure equals the list size for that `focus` (except `matchesThisWeek`, a match count). Fixed query count, never per league. |

The league page and its tabs use the existing endpoints unchanged. `docs/standards/backend.md` layering applies (controller, service interface + impl, repository; no nested types in `service.impl`); `openapi.yaml` additions only.

## UI Requirements

Composes from `PageCounters`, `FilterBar`, `ContentControlsLine`, `HeaderSeasonSelect`, `ListViewToggle`, `useListViewPreference`, `KeyFigureTile`, `SelectionGauge`, `CompactToggleGroup`, `CardTimeStrip`, `RecordCard`, `PlayerInfoCard`-style section cards, `SocialLinksRow`, `zebraTint` and the table pattern of `PlayerTable` / `MatchTable` / `PollTable`. New: `LeagueTable`, the league page header, the Schedule fixtures table, the Teams and Conditions section cards, and the form's sectioned layout. `LeagueFixtures` (also used by the edit form's Schedule tab) keeps its row list; the league page's Schedule tab gets its own table. `docs/standards/design-system.md` and `frontend.md` are updated.

## Test Plan

- **Backend:** service tests for `seasonId`, `includeInactive` and `focus` (default unchanged), a `LeaguesSummaryIntegrationTest` (parity of each quick filter with the list for several filter combinations, the match-count exception, the season of another club rejected, statement-count guard), repository tests for the new aggregates, ArchUnit, OpenAPI contract.
- **Frontend unit:** the page (season pill, counters as filters, Show inactive, toolbar, view switch and its remembered preference, empty states), the card, `LeagueTable`, the league page header and strip, each tab (toolbar filters, equal-height cards, empty states), the form (sections, validation and payload unchanged), the Edit buttons (a filled-Edit assertion per detail page). Existing tests adjusted to the new markup, not weakened.
- **Storybook:** stories for the card, `LeagueTable` and the new section pieces.

## Acceptance Criteria

- The Leagues page shows the Season pill, the six counters (three filters, three figures), the toolbar, and cards or the table; the chosen season changes every card's figures; the choice and the view survive a reload.
- The league page header, strip and the three tabs look and behave as the mockups; the Schedule filters narrow the fixtures; Teams and Conditions cards are equal height.
- A league's website and social links are reachable from the card and the league page.
- The form's Details tab is one sectioned card; saving sends the same payload as before.
- Edit is a filled primary button on every detail page.
- No permission, share-output or data rule changes.

## Open Questions

- "Players" counts distinct squad members of the club's own entered teams that season; confirm that is the meaning wanted (the league teams of other clubs have no known players).
- Whether the Teams and Schedule tabs of the *edit* form (not the view page) should later get the same toolbar treatment.

## Rollout Notes

Slices, one branch: (1) the Edit button everywhere (E, small, frontend); (2) backend: `seasonId`, `includeInactive`, `focus` and the summary endpoint; (3) the Leagues page: header, pill, counters, toolbar, new card, list view; (4) the league page: header, strip, the three tabs; (5) the edit form. Update `docs/roadmap.md` when each lands; migrations: none.
