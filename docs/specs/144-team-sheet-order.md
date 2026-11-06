# 144: Team sheet order (batting order or alphabetical)

**Status:** approved 2026-11-06 on the owner's answers (below); not built yet. Requested by the owner: "Team sheets should be published as batting or alphabetically. Wherever the team sheet is shared, in every format, the user should have a toggle to share it as a batting order or simply alphabetically."
**Depends on:** `131` (match sharing: `ShareMatchDialog`, the content catalogue, the control strips), `030`, `039`, `040` (team sheet, WhatsApp text, announce team), `099`/`141` (player names and initials), `143` (the page anatomy the toggle follows).

## Problem & Goals
Every shared lineup lists the XI in batting order, numbered 1 to 11, with the 12th man apart (`lineupOf` in `utils/share/shareMatchData.ts`). A manager who wants to publish the team before the batting order is settled, or who simply prefers an alphabetical list, cannot.

**Goal:** the sharer chooses, per share, to publish the lineup as **Batting Order** (today's behaviour) or **Alphabetical**, in every format that carries a lineup, with the output reading correctly in each (no batting numbers on an alphabetical list).

## Non-goals
No change to how the XI, captain, wicketkeeper, roles or the 12th man are chosen or stored; the batting order itself stays as picked in Team Selection. No backend, migration or `openapi.yaml` change: this is a presentation option on the client-side share model. Result sharing (`114`) and league sharing (`122`) are untouched. The Player Hub is untouched.

## User Stories
- As a manager sharing a match, when the content carries a lineup I see an **Order** toggle, **Batting Order | Alphabetical**, and every format I then choose (PDF, image, TV summary, WhatsApp, Facebook) uses it.
- As a manager, an alphabetical list shows no batting positions; a batting list shows 1 to 11 as today.
- As a manager, captain, wicketkeeper and role markers, jersey numbers and the 12th man line appear the same in both orders.
- As a manager, what I last chose is the default next time, so I do not set it on every share.

## Behaviour
- **Where it applies:** the contents that carry lineups (`usesLineup`: Team Selection Poster and Team Sheet) in all their formats (PDF, image, TV, WhatsApp, Facebook), for our side, the opposition and both sides alike, from every entry point that opens `ShareMatchDialog` (Matches, Match page, Team Selection card, Select Team page, announce team).
- **Alphabetical sort:** by surname, then first name, case and accent insensitive, using the real name even when the name is shown as initials ("J. Smith" sorts under Smith), so the list does not change order when the initials switch flips. The 12th man stays last, outside the sort, as today.
- **Alphabetical output:** no position numbers, no batting-order wording; a line such as "Team (alphabetical)" is not added, the list simply reads as a list. A player without a batting position is not special in this order.
- **Batting output:** exactly as today (numbered players first, then the ones still waiting for a position).
- **Where the control sits:** in the dialog's control strip next to Side and Layout, a compact toggle (`CompactToggleGroup`, labels "Batting Order" and "Alphabetical", Title Case), shown only for contents that use a lineup. Changing it regenerates the preview and any editable text (the existing "regenerate" rule of `039` applies; edited text is not overwritten without the existing guard).
- **Model:** `MatchShareLineup` keeps its players; `lineupOf` takes the order and sorts, and a `showPositions` flag on the model lets the PDF, image and text generators drop the numbers. Every generator already reads the model, so no generator formats order by hand.

## Test Plan
- **Unit:** `lineupOf` in both orders (surname then first name, accents, initials-only keeps the real-name sort, 12th man last, a player with no position, a single-name player); `matchText`, `matchPdf`, `matchImage` with and without positions; the remembered choice.
- **Component:** the toggle appears only for lineup contents, switching it regenerates the preview and the WhatsApp or Facebook text, the default is the last choice.
- **Not run:** Playwright; the visual check of the PDF and poster is the owner's.

## Acceptance Criteria
1. A lineup share offers Batting Order and Alphabetical, and every format honours it.
2. Alphabetical lists read A to Z by surname with no batting numbers; batting order is unchanged.
3. Captain, wicketkeeper, roles, jersey numbers and the 12th man are the same in both orders.
4. The choice is remembered for the next share.
5. Existing share tests stay green apart from the new option.

## Decisions (owner, 2026-11-06)
1. **Default:** Batting Order. The last choice is remembered per manager in the browser (the draft's default, not contradicted).
2. **Sort key:** both names, surname then first name.
3. **Contents:** the toggle on the Team Selection Poster and the Team Sheet.
4. Unanswered, so the draft defaults stand: the numbers are dropped in the alphabetical list; the label is "Order" with "Batting Order | Alphabetical"; the 12th man is always last; one frontend-only PR.

## Rollout Notes
Frontend only; no migration. Update `131` (control strips), `docs/roadmap.md` (row `144`) in the same PR.
