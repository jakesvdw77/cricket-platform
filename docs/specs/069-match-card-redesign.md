# 069 — Match Card Redesign

**Depends on:** `037-match-improvements.md` (the Matches list and its filters), `040-announce-team.md` (announced badges), `030-team-sheet-communication.md` (the Team Sheet dialog), `029-league-management.md` (the Select Team / Playing XI screen and `SquadPicker`, which reuses this card), `036`/`059` (view-first and click-to-view cards), `064`–`068` (poll cards, `RecordCard` footer buttons and badge tones, poll Responses pages, batched poll queries).
**Status:** approved (design approved by the user). Amended during build: a club team with no selection yet reports 0 picked (not null), and a side counts as one of the club's teams when its team belongs to this club. Design: https://claude.ai/artifact/BBSzMNUBLhQjpuuAWR7CJK

## Problem & Goals

The Matches list card is cramped: the date, venue and league run together in one horizontal row, the footer is a row of long text buttons, and it shows none of the things a manager actually wants at a glance on a match: how many players are picked, and whether the availability poll is open. It looks and feels unlike the Availability poll card the user rates as the benchmark. This is the first of several planned changes to Matches; it covers the **card layout only**.

**Goals**
- The match card looks and behaves like the poll card: icon-over-caption footer in equal columns with the divider above, colour-coded badges, a roomier layout with the match details stacked vertically, and cards in a row at equal height with the footer pinned.
- A **Selection block** shows how many players have been picked for each of the club's teams in the match, out of the playing XI size, in place of the poll card's availability bar.
- A **poll badge** shows whether the match's availability poll is open, closed or absent.
- The same card is used wherever the match card is used today (the Matches list and the Select Team screen).

## Non-goals

- **Any other Matches change** (filters, the match form, detail page, creation flow); the user will specify those separately.
- **Deleting or deactivating from the card.** Deactivating lives on the match edit screen (`038`); the card has no corner action.
- **Changing how polls, selection, announcing or team sheets work.**
- **Per-poll detail on the card** (answers, counts); that stays on the poll pages.

## User Stories

- As a manager, I see each match as a card with the title, status badges, the match details stacked as When, Venue and League, and a Selection block, so I can read it at a glance without it feeling cramped.
- As a manager, I see how many players are picked for each of my teams in a match, out of the playing XI, with a progress bar.
- As a manager, I see whether the match's poll is open, closed or not set up.
- As a manager, the card's four footer buttons (Edit, Select, Poll, Share) are icon-over-caption like the poll card, with clear space between them, and none is clipped at any width.
- As a manager, I click Poll to land on the match's poll, or to start one if there is none.

## Data Model Changes

None. The additions are read-only fields on the existing match list response.

## API Contract

The matches list response (`GET /api/v1/manage/clubs/{clubId}/matches`, `MatchDto`) gains, computed for the page in **batched queries** (no per-match queries):

| Field | Meaning |
|---|---|
| `homePickedCount`, `awayPickedCount` | Players selected in that side's playing XI (`MatchSidePlayer` rows for the match and team); `null` when that side is not one of the club's teams; `0` for a club team that has no selection yet (so its Selection row still shows "0 of M picked") |
| `playingXiSize` | The league's playing XI size (`League.maxPlayingXiSize`); `null` when the match has no league |
| `polls` | 0 to 2 entries `{ type: SQUAD \| GROUP, teamId, pollId, roundId, open }`: one squad poll per club team side, or a group poll covering the match (a group poll covers the match once, a squad poll per side) |

The existing `homeSideAnnounced`/`awaySideAnnounced` stay as they are. Section scope and pagination of the list are unchanged. The batch sources are the ones added for the Player Availability grid (`MatchSidePlayerRepository.findByMatchSideIdIn`, `MatchSideRepository.findByMatchIdIn`, `MatchAvailabilityPollRepository.findByMatchIdIn`, `SectionAvailabilityWindowMatchRepository.findByMatchIdIn`, windows via `findAllById`, leagues via `findAllById`).

## UI Requirements

Built on the shared `RecordCard` (its `footerButtons`, `children` body slot and the poll badge tones from `064`–`066`); no new shared component is expected. The card keeps today's whole-card click to view the match (`059`).

- **Header:** a cricket avatar, the title "Home vs Away" (wraps to two lines rather than truncating), and a colour-coded badge row: per real team side **Announced** (green) or **Not announced** (grey), prefixed with the team name only when both sides are the club's teams (as today); **Inactive** (grey) for an inactive match; and the **poll badge**: **Poll open** (solid green) if any of the match's polls is open, **Poll closed** (red) if it has polls and none is open, **No poll** (dashed outline) if none.
- **Details, stacked vertically** with a small icon, label and value per line: When (e.g. "Sat 3 Oct, 10:00", the app's usual date style), Venue (omitted when empty), League and season (omitted when none). More vertical space than today is intended.
- **Selection block** (a divider above): one row per real team side of the match, each "<team name>  N of M picked" with a progress bar and "N picked · K to go" (or "squad complete" at M of M). "M" is `playingXiSize`; with no league the row reads "N picked" with no bar. When neither side is one of the club's teams, the block is replaced by a short note that there is nobody to pick.
- **Footer** (`footerButtons`, four equal columns, icon over a single short caption, the divider above, clear gaps between buttons, never clipped or wrapped): **Edit** (the edit route), **Select** (the Playing XI tab; disabled with an explanation when neither side is the club's team), **Poll** (see below), **Share** (today's Team Sheet dialog; disabled with an explanation when neither side is the club's team).
- **Poll button:** no poll opens the New poll flow prefilled for the match (group branch `?type=group&sectionId=…&matchId=…`); one poll opens its Responses page (`/manage/availability/squad/:matchId/:pollId` or `/manage/availability/group/:roundId`); two polls (a derby with a poll per side) open the match's Availability tab. Disabled when neither side is the club's team.
- **Layout:** the list grid uses `auto-fill, minmax(340px, 1fr)` with `alignItems: stretch` so cards are never narrower than 340px and every card in a row is the height of the tallest, footer pinned at the bottom (as the poll list). Phone: one column, same card.
- **Select Team screen (`SquadPicker`)** gets the same card; its Edit still routes to the Playing XI tab as today.

## Test Plan

- **Backend:** the match list populates picked counts per side, `playingXiSize`, and `polls` for squad-covered, group-covered, derby (two polls) and unpolled matches; `null` where a side is not the club's team or the match has no league; batch-query guard (each batch method called once per page, no N+1); section scope and pagination unchanged; custom queries covered by the existing/added Testcontainers tests; `openapi.yaml` updated (additions only).
- **Frontend (Vitest/RTL):** the card renders the title, every badge state (announced, not announced, both-sides-prefixed, inactive, poll open/closed/none, either-open rule), stacked details with omitted empty lines, Selection rows (N of M with bar, no-league variant, squad complete, derby two rows, no-real-side note), the four footer buttons in order with their destinations (Poll: new poll / one poll / two polls) and disabled states with explanations, equal-height grid styles; `SquadPicker` still routes Edit to the Playing XI tab; existing `MatchList` tests updated for the new structure.
- **Browser check** at phone, two-column and wider widths (footer never clipped, cards equal height).

## Acceptance Criteria

- A match card looks and feels like the poll card: same footer pattern, colour-coded badges, stacked details, equal-height rows.
- Each of the club's teams in a match shows "N of M picked" with a progress bar, M being the league's playing XI size.
- The poll badge shows Poll open, Poll closed or No poll, and Poll opens the right place for zero, one or two polls.
- No footer button is clipped or wrapped; the matches list needs no extra per-card requests.
- The Select Team screen uses the same card and its Edit still opens the Playing XI tab.

## Rollout Notes

Backend first (read-only fields on the list response), then frontend. This is the first Matches change; further Matches changes will arrive as their own specs.
