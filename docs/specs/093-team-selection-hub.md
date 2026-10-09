# 093 — Team Selection Hub and the Select Team Page

**Depends on:** 040 (announce), 069/074 (availability coverage and the Players grid), 076 (team selection and its rules), 079 (manager shell), 087–092 (the gold standards: `FilterBar`, `ContentControlsLine`, `PageCounters`, `HeaderSeasonSelect`, `KeyFigureTile`, zebra tables, the hub switch of the Availability hub).
**Status:** built on branch `feat/093-team-selection-hub`, awaiting the user's browser check (not yet merged, no PR). Originally a draft, written 2026-10-09 from the user's notes on the current match selection screen and the "Squads" menu entry. Mockup canvas (https://claude.ai/artifact/WSvX67AUZdtggCFRNNqJKD: Matches, Players, Time slots, Batting order, and the Select team page) **approved by the user on 2026-10-09 as "a great start"**, to be refined once they have used it; this text has not been reviewed line by line.

## Problem & Goals

"Squads" (`/manage/squads`, `SquadPicker`) is really a per-match selection list, easily mistaken for the Matches list; the name clashes with a team's season roster (the Squad card on the team page). The page where players are actually picked (the Home XI / Away XI tabs inside Edit Match) is off-standard: oversized role icons, heavy colored role pills, the Availability button stranded at the top, and the actions split from the picking.

- **A. Team selection hub:** rename the menu entry and page "Team selection" and give it four views behind a switch like the Availability hub: Matches, Players, Time slots, Batting order.
- **B. Select team page:** the picking page, brought to the standard, reached from every view.

## Non-goals

No change to selection rules, availability rules, announcing, share outputs, permissions or the data model (spec 076 stays the authority). No new availability concept in the selection views.

## User Stories

- As a manager, I see which matches still need a team, are part picked, or are ready to announce.
- As a manager, I see at a glance who is picked for which match, and pick or unpick from the grid.
- As a manager, I compare the batting orders of the matches in a time slot side by side.
- As a manager, I pick players, check availability and announce from one page.

## Team selection hub (A)

Mockup boards 1–4. Menu entry and page title "Team selection" (People group; route may stay `/manage/squads` with a redirect from a new `/manage/team-selection`). Header: title, Season pill (`HeaderSeasonSelect`, no All), switch **Matches | Players | Time slots | Batting order**. Shared `FilterBar` (League, Section, Team, Search), content line with **Show past**.

- **Matches:** counters (quick filters): Upcoming matches, Not started (amber), In progress, Ready to announce, Announced. Zebra table: When, Match, Team, selection gauge ("12/12"), Status, action (**Select players**, or **Announce** when full). Whole row opens the Select team page.
- **Players:** a grid of players by match (columns grouped by day and slot). A cell shows only **picked** (filled tick) or **not picked** (faint circle); legend "Picked / Not picked"; footer row "Picked n / max". **Clicking a cell picks or unpicks** and applies the spec 076 rules unchanged: a player who cannot be picked (said unavailable, unsure or no response, age rule, already picked in the same slot) has a muted cell whose tooltip gives the reason, and a refused pick shows the rule's 409 message. No availability states appear in this view.
- **Time slots:** one block per day and slot, one card per match listing the picked players in batting order with Captain and Wicketkeeper markers and the 12th man labelled, the selection gauge and the announced chip. No list of available-but-unpicked players (dropped by the user).
- **Batting order:** a matrix, columns = matches grouped by slot (header: match, date, time slot, gauge), rows = batting positions 1–11 then "12th man", cells = the player's name with C / WK markers, "+ Add" for an open position (offers only eligible players). Footer per column: Select, and Announce when full. Click a name to change player or position.

## Select team page (B)

Mockup board 5; replaces the Home XI / Away XI tabs of Edit Match (Edit Match keeps its Details). Header: Back, Season pill, logo, title "Team v Opposition", date, league, Home/Away; one **action group** at the right: **Availability** (outlined), **Announce team** (outlined), **Select players** (filled). Home XI | Away XI switch. Key-figure strip (`KeyFigureTile`): Selected "12 of 12", Captain, Wicketkeeper, Status. Zebra player table: drag handle, batting position, name with small C / WK markers, role as **text** (no icon pill; role icons are under 32 px so MUI icons only, if any), a small availability tick, row menu (captain, wicketkeeper, batting position, remove). Same behaviour and rules as today. The stray **Deactivate** control at the top is reviewed during planning: if it is not a selection action it moves to Edit Match's Details.

## API Contract

To be fixed in planning. Expected: the Matches view and its counters from the existing matches and sides data where one batched read is available, otherwise one new read endpoint `GET /api/v1/manage/clubs/{clubId}/team-selection?seasonId&leagueId&sectionId&teamId&includePast` returning, per match, the picked players in order with markers, selection counts, max, announced state and per-player pick eligibility (reason code), computed with the same `SelectionRules` as the pick writes. Picking and unpicking reuse the spec 076 apply endpoints. No migration.

## UI Requirements

Reuses `PageCounters`, `FilterBar`, `ContentControlsLine`, `HeaderSeasonSelect`, `KeyFigureTile`, `SelectionGauge`, the zebra table skeleton, the Availability hub's switch and the existing Select players dialog. New: the four hub views, a pick-state grid cell, the Select team page header and action group. `docs/standards/design-system.md` and `frontend.md` updated.

## Test Plan

Backend (if the endpoint is added): service tests, integration test with parity to the picking rules (a cell reported pickable is accepted by the apply endpoint and vice versa), statement-count guard, ArchUnit, OpenAPI. Frontend: each view (counters as filters, grid click picks and unpicks, muted ineligible cells with reasons, matrix cells, empty states), the Select team page (action group, strip, table, rules errors), the renamed menu and redirect. Storybook for the new pieces.

## Acceptance Criteria

- The menu and page say "Team selection"; four views switch without losing filters.
- Picking from the Players grid and Batting order obeys every spec 076 rule and shows the reason when refused.
- The Select team page shows one action group, the strip and the zebra table, with no oversized icons or colored pills.
- Announced state, captain and wicketkeeper agree across all views and the page.

## Open Questions

- The `Deactivate` control (not found on the Edit Match page in code; seen by the user at the top): what is it and where should it live?
- Keep all four views, or drop Time slots (which Batting order largely covers)? Proposed: build all four, drop one later if unused.
- Phone layout for the grid and matrix (horizontal scroll with a sticky first column proposed); no phone boards drawn yet.
- Whether Announce can be a bulk action from the Matches view.

## Rollout Notes

Slices: (1) rename, route and the Matches view; (2) the Select team page; (3) Players grid with click-to-pick; (4) Time slots; (5) Batting order. Backend only if planning shows a batched read is needed. Update `docs/roadmap.md` as each lands.

## Built as

What differs from the draft above (the plan is `docs/plans/093-team-selection-hub.md`):

- **Players grid shows availability.** Cells use `CellMark` (Available, Unsure, Unavailable, No response, Not polled) with a picked dot and ring on top, reversing the draft's picked / not picked only. Backed by a new `availability` field on each overview cell (backend commit 492621d).
- **Batting order:** per-column Reorder (arrows only in edit mode; on an announced side the first move asks "Change an announced team?"), a Short names option (persisted in `teamSelection:battingShortNames`) and a compact header (gauge with "n / max" and a tick).
- **Previous slot / Next slot arrows** on the Batting order, Players and Availability players grids: they scroll to the nearest group start with a gentle snap.
- **"View entire season"** replaces "Show past" on the selection and Availability pages, because those switches are season-scoped. The Matches list and League schedule past switches follow it too (886d899); on Matches the label reads "View all seasons" when All seasons is chosen. The label of the closed-polls switch stays "Show closed polls".
- **Availability polls and counters are season-scoped (amendment to specs 083 and 084).** Backend: an optional `seasonId` on open and closed squad polls, section availability rounds and both availability summary endpoints (48df2fe, a395179); a round counts for a season when any active slot match in its windows has that season, and an absent `seasonId` behaves as before. Frontend: the Availability polls page and the hub counters send the hub's season, with requests held until seasons load, and `AvailabilityHubLayout` now loads seasons on every view (5f0659b, 0d5c576). The counter rule of 083/084 is therefore that counters and lists share the season; a backend parity test keeps them equal.
- **Captain and Wicketkeeper are pickers on the Select team strip** (`RolePickerTile` / `KeyFigureTile` `onClick`). One shared `AnnounceTeamDialog` serves the Select team page and announce from Matches rows and the Batting order footer: a missing captain or keeper gives a non-blocking warning with a picker, the button reads "Announce anyway" while one is missing and unchosen, chosen roles are saved before announcing, and a failed save blocks the announce and keeps the error in the dialog (124f731).
- **Share team is built on three pages** (4f1d836): a Share team button in the Select team page's action group beside Announce (disabled with a tooltip until announced), a Share on an announced Matches row, and a Share on the Time slots card. They reuse `useTeamSheetShare` and `TeamSheetCommunicationDialog` (new optional `initialScope`) through the glue hook `useShareAnnouncedSide`. Bulk share per day is not built.
- **Density:** grid rows are about 32 px, and the shared `useFillViewportHeight` ignores the footer when a taller side column pushes it below the fold.
- **Deactivate** (open question) lives on Edit Match Details.
- **Edit Match** no longer has the Home/Away XI tabs; old `?tab=playing-xi` style links redirect. Edit Match gains a Select team link.
- **`/manage/squads`** redirects to `/manage/team-selection`.
- **Time slots view kept** for now.
- **Not in 093:** the planned (announced) batting order versus the actual order from a future Results module is a roadmap item.
