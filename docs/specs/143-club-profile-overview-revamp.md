# 143: Club Profile, Club Structure and Overview revamp

**Status:** built 2026-11-06 on `feat/143-club-profile-overview-revamp` (PR #160), owner hand-check pending. **Written after the build**, from the owner's live instructions in the browser review, not before it: this file records what was decided so the next page does not re-ask. Applies `docs/standards/page-anatomy.md` (binding, including section 0) and `140` to `142` as the worked examples.
**Depends on:** `056` (Club profile overview), `094` (club structure and seasons), `122` (share formats), `127` (`returnTo`), `129` (flat cards), `136` to `142` (pattern and shared pieces).

## Problem & Goals
The Club Profile, Club Structure and Overview pages were the last manager pages still on the old look:
- **Club Profile:** an h5 "Club profile" title over a band, a filled "Edit profile" button, three icon `KeyFigureTile`s, raised cards with plain "Manage" text links, a raw MUI button in the empty structure, an icon-only expand button next to Manage Structure, and the Share formats card as ten loose switches.
- **Club Structure:** the editable tree on a card with a collapsible "Section details" rail beside it (an empty panel and a "<" chevron when nothing was selected).
- **Overview:** a greeting with raised key-figure tiles, raised cards, raw MUI buttons, sentence-case actions.

**Goals:** bring all three onto the standard without losing a function, and fix the defects the owner and the tester found on the way (listed under Amendments).

## Non-goals
No backend, migration or `openapi.yaml` change; no change to sections, contacts, sponsors, share settings or the overview data. The Player Hub and the Keycloak journey keep their own look (only the backdrop and login contrast fixes below). Open items from the tester list that nobody could identify (the Results share dialog layout, "move directions" on the Team Selection card) are not part of this spec.

## What changed
| Area | Before | After |
|---|---|---|
| Club Profile header | h5 title, avatar, type chip, filled Edit profile | `ManageScreenHeader`: logo, the club name, ONE type badge, ONE filled **Manage Club** menu (Edit Club Profile, Manage Contacts, Manage Sponsors, Manage Structure); no Back, no Season pill |
| Club Profile figures | Three icon tiles | Compact static `PageCounters`: **Divisions**, Teams, Leagues, Players. Divisions is the count of active sections with no active section beneath them (the lowest levels), with an info icon saying so |
| Club Profile cards | Raised, text "Manage" links | Flat; compact outlined buttons with names (Edit Details, Manage Contacts, Manage Sponsors, Manage Structure, **View Full Screen** on the structure card); empty structure is the "Create New Section" link; every leaving link carries `returnTo` "Club Profile" |
| Share formats | Ten loose switches in a full-width card | Toggle chips (`ToolbarToggleChip`, the standard for an on/off choice), Results and Leagues side by side from `md`; the last format on a content type stays disabled with its explanation line |
| Club Structure | Tree card plus a collapsible details rail | The editable tree opens **full screen** (`OrgChartFullScreen`: zoom 50 to 200 percent, Fit to screen, Close returns through `returnTo`). The selected section's details are an `aside` column inside the overlay (not a modal drawer, which blocked the tree); an error from Remove shows in the overlay's `notice` slot |
| Overview | Greeting band, raised tiles | Shared header (greeting as the title, the date as the sub-header, the Quick Actions menu on the right); four compact counters that each open the page behind the number (Team Not Announced in the warning tone above zero); flat cards with a compact outlined button at the right edge; empty cards carry ONE underlined link; actions read "Create New Match", "Create New Poll", "Add New Player" |

## Amendments from the owner's and the tester's review (2026-11-06)
- **No chevron on any counter** (filter or drill). The cue is the pointer, the hover lift and the green ring. Supersedes the drill-down chevron of `084`.
- **Season card** uses the Seasons brand icon (`nav/season-cricket`, as the menu does), not a calendar icon.
- **Match card:** the venue, with its Get Directions button, is part of the weather information: it sits inside the forecast strip (`CardForecastStrip` `venue`, `CardTimeStrip` `below`), no longer under the league line.
- **Team Selection card:** the Team list is hidden by default; "Show Team" opens it.
- **Player stats, Batting tab:** Recent form sits above Milestones.
- **Leaderboards:** no team name under a player's name (a player can play for several teams and the second line made rows taller); no "Showing N of M" line (the basis lines stay); award card winner name 17 px and the sub-line 13 px.
- **Squad picker:** the Section select has its own fixed width so Search no longer collapses to a sliver.
- **Batting position field** (the player menu on Team Selection and Capture Result): no label inside the 84 px field (the label is beside it), so the placeholder, the current place, shows instead of "Battin...".
- **Contrast on the cricket scene:** the dark central column on `PageBackdrop` and, in the Keycloak theme, the pitch strip now starts under the brand and runs behind the card, so cream text never lies on the sand pitch. Login loaders use the medium ball (56 px), not the large one (88 px).
- **Side menu:** the collapse button is 28 px high, so the gap above Overview is small.
- **Leaderboard default season:** left as is. The current season is already the default on a first visit; Clear Filters deliberately means All Seasons (`140`), and the tester most likely saw a saved All Seasons choice.

## Test Plan
- **Unit/component (done):** Club Profile (header badge, Manage Club menu items, Divisions count including inactive and parent sections, counters, buttons, empty-state link, overlay and drawer), Club Structure (full-screen dialog, details column, close, remove clears selection, `?sectionId=`), Overview (counters, tones, empty links, actions menu), `ShareFormatsSettings` chips, `PageCounters` and `AvailabilityHubLayout` without markers, `SlotsView` Show Team, Leaderboards without the team line and count text; the page-anatomy guard drops `ClubOverviewPage` from its baseline.
- **Not run:** Playwright; the 375 px check, the zoom and click behaviour inside the scaled tree, and the Keycloak and backdrop contrast are the owner's browser check.
- **Known flake:** the full unit suite times out intermittently under load (a different set each run); every group passes when run alone.

## Acceptance Criteria
1. The Club Profile follows section 0: one filled Manage Club menu, compact counters (Divisions included), flat cards, compact named buttons, no Back and no Season pill.
2. Manage Structure opens the editor full screen with zoom and Fit; selecting a section shows its details beside the tree without blocking it.
3. The Overview has the shared header, linked compact counters and flat cards; no raw MUI button remains on the three pages.
4. No counter shows a chevron anywhere.
5. Cream text is readable on the backdrop screens and the Keycloak login at any window height.
6. Existing profile, structure, contact, sponsor, share-format and overview behaviour is unchanged.

## Open questions
1. Should the Results, League and Match share dialogs lay their format tiles out differently? The tester's note was unclear and the owner did not know what it meant; nothing changed.
2. "Move directions" on the Team Selection card: not identified.
3. Should "Based on N published results" on the Leaderboards move into an info icon on a figure card (section 2)? It stays as a footer line for now.

## Rollout Notes
Frontend plus the Keycloak login theme CSS (rebuild the theme with `keycloak/package.sh`); no migration. `page-anatomy.md` and `roadmap.md` are updated in the same PR.
