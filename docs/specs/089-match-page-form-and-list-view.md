# 089 — Match Page, Add/Edit Match Form and Matches List View

**Depends on:** 032 (match availability polls), 037, 042, 069 (match card), 075 (match view and edit), 076 (team selection), 081 (page counters), 087 (Matches aligned with Polls: counters, toolbar, card), 088 (Players: Player page standard, `ListViewToggle`, `useListViewPreference`, list-view standard in `docs/standards/frontend.md`)
**Status:** draft — written 2026-10-09 from the user's request ("the view page looks horrible, align it with the Player gold standard; the new Match form uses a massive amount of space, the toggles look like no other toggles, it feels bloated"; plus the Matches list view that 088 left on the roadmap). The mockup canvas (https://claude.ai/artifact/8mfk6JmQnfPzgRpwEHz7gV: match page desktop and phone, add/edit form desktop and phone, list view desktop and phone) was **approved by the user on 2026-10-09** ("Mockups look amazing"); the spec text has not been reviewed line by line. **Built** on branch `feat/087-slice-1-shared-pieces` (plan: `docs/plans/089-match-page-form-and-list-view.md`); awaiting the user's browser check. The revised match header (A, revised: top row, no header badges, logo beside each name, `SelectionGauge`) is built too (plan: `docs/plans/089-090-header-revision-and-poll-page-actions.md`); on a phone the Scoring and Live links sit in a halves row under the actions rather than thirds. Built as specified, with these readings: the Poll tile's caption shows "Closes <when>" only when exactly one open squad poll has a scheduled close (group polls carry none), otherwise "n polls" / "No poll yet"; the date field label stays "Match date & time"; `MatchTable` lives with `MatchCard` under `pages/manage/matches/` (it needs the card helpers).

## Problem & Goals

Matches got its counters, toolbar and card in 087, but two screens a manager lives in still look like the old product. The **match page** is a thin header with a line of details and three plain buttons above the team cards: it is dull next to the Player page. The **Add / Edit match form** is tall and sparse: every field full width with helper text under it, two full-width three-button toggles ("My team / League team / Other") that look like no other toggle in the app, and two stacked team sections, so a single new match needs several screens of scrolling. And Matches has no **list view**, though Players does and the roadmap promised the same switch here.

Goals:
- **A. Match page:** the Player page treatment: a larger header, a key-figure strip, cards with icon-tile headings.
- **B. Add / Edit match form:** a compact form that fits one screen on a desktop, with side selectors in the app's compact toggle style.
- **C. List view:** a Cards | List switch on Matches with a compact zebra table, using the shared pieces from 088.

## Non-goals

- No new data, endpoints or migrations: all three parts are frontend only, reusing what the card, the page and the form already load.
- No change to what a match, a side, a poll or a selection *is*; the form keeps the same fields, the same validation and the same save payloads.
- The Playing XI picker tabs on the Edit page (Home XI, Away XI) keep their behaviour; they only pick up the compact spacing (see B).
- The Polls list view stays on the roadmap (its own spec and mockup).
- Real scores or results on the match page: no data source exists.

## User Stories

- As a manager, I can open a match and see at once when it starts, where, in which league, whether the poll is open, and how complete each team's selection is, so that I know what still needs doing.
- As a manager, I can start team selection, open the availability, share the team sheet or edit the match from the top of the page, so that the common actions are one tap away.
- As a manager, I can add a match on one screen without scrolling past empty space, so that adding a fixture is quick.
- As a manager, I can choose each side as My team, League team or Other with a small switch that looks like the app's other switches, so that the form feels consistent.
- As a manager, I can switch Matches between Cards and List and have the app remember my choice, so that I can scan many fixtures at once.

## Data Model Changes

None.

## Match page (A)

**Revised 2026-10-09 after the user's review of the built page** ("the Polls header looks cleaner, the Match header has left buttons; badge 1 vs badge 2 is redundant; the poll gauge looks nice, team selected could follow that"); mockup boards 1 and 2 of the Matches canvas were redrawn and **approved by the user the same day**. The revision supersedes the matching bullets below:
- **Header layout like the poll page:** the Back link on the left of the top row, and **Scoring**, **Watch live** (only when the match has the link) and the filled **Edit** on the right of that same row (page-level actions). The title row is the title on the left and the match workflow buttons **Select team**, **Availability** and **Share team sheet** right-aligned beside it (wrapping below the title on a narrow screen). On a phone: Edit sits on the Back row; Select team and Availability are two full-width halves, Share, Scoring and Live thirds under them.
- **No header badges:** the Announced / Not announced pair (one per own side) and the poll badge leave the header, because each team card shows its own Announced chip and the Poll tile shows the poll. Only an **Inactive** badge stays when the match is inactive.
- **One title, no duplicate "vs":** the logo tile pair (IRV vs PO) is replaced by a logo tile beside each team name that has a real logo, in the title itself (`[logo] Irene Villagers 1 vs POHBS`); a side with no logo shows no tile (initials add nothing next to the name).
- **Selection gauge like the poll's:** each team card shows the selection as a 10 px bar with a colour-keyed legend underneath ("● 10 Picked  ● 2 To go"; "squad complete" when full), the same look as the poll response gauge; "10 of 12 picked" stays on the Playing XI row, with the announced chip beside the "Playing XI" label. Match page team cards only (the match card and the list keep their bar).

Same data, actions and states as today; redesigned (mockup boards 1 and 2):

- **Header:** the two team logo tiles (64 px, 52 px on a phone) with "vs" between them, the title at the page-title size (1.75 rem, 1.4 rem on a phone) with the badges under it (Announced status first, then the poll badge, as the card), and on the right **Scoring** and **Watch live** (outlined, only when the match has the link) and **Edit** as the filled dark green primary button. The "Back to Matches" link stays above.
- **Action row:** **Select team**, **Availability** and **Share team sheet**, outlined, under the header, with the existing rules (all disabled with the existing reason when none of the club's teams plays; Availability disabled until the polls are ready; Share shortens to "Share" on a phone). On a phone: Select team and Edit are two full-width halves, Availability and Share the next two.
- **Key-figure strip:** four non-clickable tiles, each a tinted icon tile and a large value with a caption: **Starts** (the date, caption the time and the live countdown, amber within 24 h, "Played" once started, as the card), **Venue** ("TBC" when none), **League** (name, caption "League · Season"; "Friendly" for a standalone match) and **Poll** (Open, Closed or None; caption "Poll closes <when>" while open). Four across, two across on a phone.
- **Team cards:** one per own side (two side by side when both are the club's), each with a solid-green icon-tile heading "<Team> · Home/Away", the announced chip on the right, "<n> of <size> picked · <m> to go" with the progress bar, and the Playing XI as compact 44 px zebra rows (number, `#jersey` and name, Captain and WK chips, role on the right), the first rows with "+ n more" and the existing link to the selection. A side with nobody selected keeps the "No players selected yet" text and Select team button.
- **States:** unchanged loading, error and not-authorised states; the "none of your teams is playing" text stays.

## Add / Edit match form (B)

Same fields, validation and save as today (mockup boards 3 and 4):

- **Layout:** one card, with a "Match details" heading (solid-green icon tile) over a three-column grid: Season, League, Date & time, Venue, Scoring link, Streaming link; then a "Teams" heading over two side-by-side panels, Home and Away; then a footer with the one-line hint and **Cancel** and **Create match** (Save on edit). One column on a phone.
- **Compact inputs:** 40 px fields, no helper text under them. "(optional)" goes in the label ("League (optional)", "Venue (optional)", "Scoring link (optional)", "Streaming link (optional)") and the URL examples become placeholders; validation errors still show under the field.
- **Side selector:** each panel is a bordered box with the side name and a compact segmented switch **My team | League team | Other** in the same small tinted style as the Cards | List switch (28 px high on a desktop; full width, 40 px on a phone where "League team" shortens to "League"), then the one field the choice needs (team select, league-team select, or opponent name and logo). "Choose a league and season first to pick a league team" becomes one hint line in the footer and a disabled League team option.
- **Edit page:** the same card styling and spacing on the Details tab; the Home XI and Away XI tabs keep their content and behaviour with the compact spacing. Tabs stay.

## List view (C)

Follows the list-view standard in `docs/standards/frontend.md` (mockup boards 5 and 6):

- The Cards | List switch (`ListViewToggle`) sits on the right of the content line, and the choice is remembered per user (`useListViewPreference`, key for Matches), as on Players; the Filters sheet on a phone gets the same switch.
- **Columns (desktop):** When (date and time, the countdown under it, amber within 24 h), Match (logo, "Home vs Away", "League · Season" under it), Selection (a small bar and "picked/size" for the club's side; the first own side when two), Announced chip, Poll chip, and a chevron. Zebra rows; a row, like the card, opens the match.
- **Columns (phone):** Match (names, with the time and countdown under them), Picked ("10/12") and the chevron.
- Counters, FilterBar and the sort and past-matches controls apply to both views exactly as they do to the cards; the empty and loading states are the card list's.

## Season in the header (D)

Added 2026-10-09 at the user's request ("remove the season out of the toolbar and make it a small dropdown in the header, very seldom will someone change it"); mockup boards 7 and 8, **approved by the user the same day**. On Matches the Season field leaves the `FilterBar` (toolbar and phone Filters sheet) and becomes a small pill, `HeaderSeasonSelect` ("📅 2026/2027 ▾"), on the title row beside the page title (under the title on a phone). It opens a short menu: **All seasons** first, then each season, the current one ticked. Behaviour is unchanged: the default is All seasons, the choice is still remembered with the other persisted filters, the list, the counters and the filter options still follow it, the chosen season still appears in the "Showing: …" line under the title, and "Clear all" in the toolbar leaves the season alone (it is no longer a toolbar filter). Matches is the only page with a Season filter today (Players and Availability apply the season silently), so no other page gets the pill; it is a shared component ready for any that later needs one. `FilterBar` keeps its optional `seasons` slot (unused by Matches now) so a future page can still choose a toolbar Season.

## UI Requirements

Composes from: `PageHeaderBand`, `Card`, `badgeSx`, `CardProgressBar`, `PlayingXiSummary`, `ListViewToggle`, `useListViewPreference`, `PageCounters`, `FilterBar`, `ContentControlsLine`, `zebraTint`, `formatMatchDateTime` and the 087 countdown helper. New pieces, page-specific and under `pages/manage/matchDetail/` and `components/MatchForm/`: a match key-figure strip, a team-card heading with icon tile, a `MatchTable` (list view), and a compact `SideModeSwitch` (the segmented switch, built on the same tokens as `ListViewToggle`; if a second consumer needs it, extract a shared `CompactToggleGroup`). The "Record detail page" paragraph in `docs/standards/design-system.md` is extended to cover match pages; the form's compact density is recorded there too.

## Test Plan

- **Frontend unit:** `MatchDetailPage` (key figures, badges, actions and their disabled reasons, own-side cards, empty selection), the new strip and table components, `MatchForm` (labels, side switch modes and the fields each shows, validation unchanged, league-team disabled without scope), `MatchList` (view switch and remembered preference, rows open the match, counters and filters apply to the table). Existing tests are adjusted to the new markup, not weakened.
- **Storybook:** stories for the new strip, `MatchTable` and the side switch.
- No backend tests: no backend change.

## Acceptance Criteria

- The match page shows the header, the four key figures, the action row and the team cards as in the approved mockup, at desktop and phone widths; all actions behave as before.
- A new match can be added with every field and both sides visible on one desktop screen (about 1080 px tall) without scrolling.
- The side switch looks and behaves like the Cards | List switch; League team is disabled until a league and season are chosen.
- Matches has a Cards | List switch; the choice survives a reload; the table respects the counters, filters, sort and the past-matches switch, and a row opens the match.
- No validation, save payload, permission rule or poll behaviour changes.

## Open Questions

- Should the remembered view preference be shared between Players and Matches, or one per page? 088 started with one per page; this spec keeps that.
- The Playing XI tabs on the Edit page get only the compact spacing here; a redesign of the picker itself would be its own spec.

## Rollout Notes

Slices, one branch, each reviewable on its own: (1) the match page (key-figure strip, header, team cards); (2) the compact form with the side switch; (3) the list view (`MatchTable`, switch, preference). Update `docs/roadmap.md` (remove the Matches half of the "List view for Matches and Polls" item, leaving Polls) when slice 3 lands.
