# 128: League edit page revamp

**Status:** Built, pending the owner's browser check (2026-10-31). Teams and Schedule tab removal approved by the owner 2026-10-31 ("as it makes navigation hard"); Season pill placement and the rest approved by the owner 2026-10-31 ("agree"); approved (2026-10-31); mockup `docs/mockups/league-edit-revamp-mockup.html`. Part of finishing Leagues 100% (the owner's priority).
**Depends on:** `docs/standards/page-anatomy.md` (page skeleton, Season pill beside the title, toolbar controls, button rules), `095-league-edit-gold-standard.md` (the page being revamped), `126-league-page-actions-and-edit-mode.md` (the league page now carries schedule and team actions), `127-return-navigation.md` (Back, Cancel and Save return to the origin), `052-league-playing-conditions.md`, `124-playing-conditions-balls-and-free-hit.md`, `111` (league season dates), `docs/standards/design-system.md`.

## Problem & Goals
After the league page redesign, the edit page (`/manage/fixtures/leagues/:id/edit`) is the oldest-looking screen of the league area and no longer matches it. Owner feedback (2026-10-31): the Season control appears in every tab and wastes space; a small "Use first and last match" label sits beside a large Save button; the Details tab has large gaps and is not compact; Branding and social links could be their own tab; the Playing conditions tab uses a lot of vertical and horizontal space and its toggles sit at different levels; and the Teams and Schedule tabs now overlap with the league page.

**Goals**
- A compact, consistent edit page that follows the page standard: Season pill beside the title, 36 px controls, tight rhythm, no repeated or loose elements.
- The edit page holds **settings only**; the league page holds the day-to-day schedule and team work.
- Playing conditions that read as one tidy grid, toggles aligned on one level.

## Non-goals
- Changing what any field means, its validation or its storage (no backend change, no migration).
- Changing the league page, the Share dialogs or the import.
- Redesigning the Contacts tab beyond the shared density rules (checked in the same pass, listed under Later if it needs more).

## Structure
- **Tabs (new):** **Details**, **Branding**, **Playing Conditions**, **Contacts**. The **Schedule** tab is removed (it only pointed to the league page) and the **Teams** tab is removed (the league page's Teams tab, the Add Team chooser and the team tile menus cover adding, copying, editing and removing teams). Old links with `?tab=teams` or `?tab=schedule` open the Details tab; the league page's Manage League panel stays the way in to team and schedule work.
- **Header (page standard):** Back (honours `returnTo`), then the title row "Edit League" with the league's logo and the **Season pill beside the title**, shown only on the tabs that depend on the season (Details' season dates and Playing Conditions); hidden on Branding and Contacts. The pill is the single season control of the page; no tab has its own Season select.
- **Actions:** a footer only on tabs with a form: Cancel (white) and Save Changes (filled), plus Deactivate/Reactivate on Details only (unchanged rule), all returning to the origin through `127`.

## Details tab (compact)
- One white card (hairline, flat) with a **three-column field grid at desktop width** (two at tablet, one on a phone), 36 px inputs and selects, 16 px gaps, section labels as plain small headings with a 24 px icon (no 32 px solid tile), no empty helper rows:
  - **Basic info:** Name, Format, Playing XI size, Min age, Max age, Cut-off month, Cut-off day. The age-reference sentence ("Ages are judged on 31 Dec 2026 (the cut-off)") sits under the age fields, not as its own loose line.
  - **Contact:** Phone, Website, Email on one row.
- **Season dates** move into a slim row **at the top of the card**: "Season dates for 2026/2027" (the pill's season), Start date, End date, then two same-size buttons: **Use First and Last Match** (white secondary, enabled when the season has matches, tooltip as now) and **Save Season Dates** (filled). No bare grey text beside a button, no second Season select.

## Branding tab (new, split out of Details)
Logo (the media upload, with the logo shown on its own preview tile as on the league header), Website is not repeated (it stays under Contact), and **Social links** (the existing add/remove list, each row: network, address, remove). Same card, grid and footer rules; the page-level logo preview follows the logo rule (no tile behind an image; soft green tile fallback).

## Playing Conditions tab (compact)
- Keeps the document upload and Share on a **single toolbar line** at the top (white secondary buttons, text-only; the PDF upload remains inline) with "Playing conditions for 2026/2027" as its title (no loose line above).
- **Innings:** one row of numeric fields (Max overs per innings, Powerplay overs, Max overs per bowler), then the switches in a **two-column grid**: Limit balls per over (reveals Maximum balls per over beside it), Free hit after a no ball, Allow substitutions; all switches use `CompactSwitch` at one height with the label to the right, aligned on one level. Fielding restrictions notes is a two-line field spanning the width.
- **Points:** the points fields in one row (win, tie, no result and so on as defined in `052`).
- **Bonus points:** the Enable switch and, when on, its two fields on the same row; the explanations stay as info tooltips.
- **Notes:** Additional notes, three lines.
- Section headings are plain small headings with a 24 px icon; sections are separated by a hairline, not by large gaps. The form's footer holds the error text and Save Playing Conditions as today.

## Contacts tab
Checked against the same density rules (hairline rows, 36 px controls, one filled Add Contact on the tab toolbar). Any change beyond that is a follow-up.

## User Stories
- As a club admin, I see the Season pill once, beside the title, and only on tabs that depend on it.
- As a club admin, I edit a league's details on one compact card without scrolling past empty space.
- As a club admin, I find the logo and social links on their own Branding tab.
- As a club admin, I read and change the playing conditions in one tidy grid where every switch lines up.

## Test Plan
Written after the owner's hand-check. Component tests: tab set and order, old `?tab=teams|schedule` links open Details, the Season pill appears only on Details and Playing Conditions, season dates row (Use First and Last Match and Save Season Dates same size, Start/End prefilled from the pill's season), Branding tab (logo, social links add/remove), Playing Conditions grid (switch alignment via the shared control height, balls-per-over reveal, bonus reveal), Cancel/Save return to the origin (`127`), and a phone check of the stacked grid. Existing `LeagueForm`, `PlayingConditionsForm`, `LeagueFormPage`, `LeagueEditTabs` and season-dates tests are updated; Teams and Schedule tab tests are removed with their components (their logic lives on the league page).

## Acceptance Criteria
1. The edit page has the tabs Details, Branding, Playing Conditions and Contacts; no Teams or Schedule tab, and old links still work.
2. One Season pill beside the title, only on the season-dependent tabs; no tab carries its own Season select.
3. The Details tab is one compact card on a three-column grid with the season dates row and same-size buttons.
4. Logo and social links live on the Branding tab.
5. Playing Conditions fits a compact grid with all switches on one level.
6. No field, validation or stored value changes; no backend change.

## Rollout Notes
UI only. Removing the Teams and Schedule tabs deletes `LeagueEditTeamsTab`/`LeagueTeamsSection` use and the schedule pointer from the edit page (the shared team action hooks stay for the league page). Update `docs/standards/page-anatomy.md` (League edit row, section 9) and `design-system.md` (League edit page section) when built.

## Later
The Contacts tab beyond density rules; Edit mode for the schedule (`126` Phase 2) lives on the league page.
