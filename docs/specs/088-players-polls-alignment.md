# 088 — Players Aligned With Polls, and Player Verification

**Depends on:** 028 (players), 060 and 061 (player detail and `PlayerCard`), 076 (team selection), 077 (date of birth and the Missing date of birth filter), 081 (page counters), 083–085 (`FilterBar`, `ContentControlsLine`, compact density, clickable counters), 087 (the Matches version of this same work: `PageCounters` short labels, `CardTimeStrip`, shared zebra tint, the summary endpoint pattern)
**Status:** draft — written 2026-10-09 from the user's request ("Start on the Players counters"), revised the same day. Decided by the user: four counters (**Active players**, **In a squad this season**, **Players selected this season**, **Unverified players**), their figures from a **backend summary endpoint**, a new **verification status** on the player, **one Status button on every card** that changes it (Verify, Reject, Suspend, Reactivate; a deactivated player is **Suspended**), **Reject marks the player Rejected and hides them**, **every card shows the same rows** ("–" when something is not on file) so all cards have the same height, and the scope **counters, toolbar and card** (the Matches treatment). Mockup (https://claude.ai/artifact/MjjqtGkP7iAbvz1aP7xVRH: desktop page, card before and after and per status, counter states, status menu and confirmations, phone page and Filters sheet) **approved by the user on 2026-10-09** after two rounds (one Status button, Suspended, fixed card rows); the spec text has not been reviewed line by line. Built on branch `feat/087-slice-1-shared-pieces` (plan: `docs/plans/088-players-polls-alignment.md`); awaiting the user's browser check, which needs the backend restarted (migration 040). Final API as outlined: `GET /players/summary`, the list's `includeInactive`, `focus` and `seasonId`, and `POST /players/{id}/verify` and `/reject`; "selected" counts active matches only. **Added 2026-10-09 after the card was approved, at the user's request, to the same spec:** a "games played" badge (this season and overall) in the card's top-right corner (E), and a Cards | List view toggle with a compact list view (F). Their mockups are pending approval; the rest of the mockup stays approved.

## Problem & Goals

The Players page is the other list a manager lives in, and it is still the pre-polish version of the screen: no counters, the old `ListToolbar` with a "Missing date of birth" chip stacked under the Section picker, and a bespoke `PlayerCard` whose badges sit in the top-right corner beside a truncated name. The figures a manager wants at a glance are not shown anywhere: how many players are active, how many are in a squad, how many have actually been picked to play, and (new) how many are waiting to be verified.

The verification part looks ahead. Later, parents and players will create the player profile themselves; such a profile arrives **unverified** and the manager verifies or rejects the request. That self-registration flow is not part of this spec, but the status, the counter and the manager's Verify and Reject actions are, so the manager side is ready when it lands. Until then every player is verified and the counter reads 0.

Goals:
- **A. Counters:** four clickable counters under the header, in the Polls and Matches style.
- **B. Toolbar:** `FilterBar` and `ContentControlsLine` on Players, as on Matches.
- **C. Player card:** the poll card's layout (badges under the header, subtitle, zebra detail rows), keeping the player's photo avatar.
- **E. Games played:** two small stats in the card's top-right corner, games played this season and overall.
- **F. List view:** a Cards | List switch; the list is a compact zebra table that shows many more players per screen.
- **D. Player status:** a `verificationStatus` on the player, a clickable amber "Unverified players" counter, and one Status button on the card and the player page to verify, reject, suspend or reactivate.

## Non-goals

- **No self-registration flow** (parents or players creating a profile), no notification to whoever requested the profile, and no rule yet that keeps unverified players out of squads, selections or polls. All of that arrives with registration; here the status is only set, shown, filtered and changed by a manager.
- **No sortable list columns and no column picker** in the list view (name order only, with the existing sort link); both can follow.
- **No career statistics.** "Games played" counts selections recorded in this platform, nothing before the club started using it.
- **No audit history** beyond the player's existing `updatedAt` / `updatedBy`.
- **No "Joined recently" or "Missing date of birth" counter.** Missing date of birth stays a switch (077's filter, moved to the content line).
- **No pagination.** The roster is a small bounded list (028); it stays fetched in full and searched by name in the browser. The quick filter and the Show inactive switch are backend parameters like Section and Missing date of birth, so the counters and the list share one definition.
- **No League, Season or Team filter on Players.** They do not describe a player; the two season figures use the default season behind the scenes (below).
- **No change to the Player detail page beyond the verification banner and actions, the player form, section tagging, or the public availability form.** No other new player fields.
- **No server-side search**, so the counters do not follow the search box (the same decision as 083 for Polls).

## User Stories

- As a manager, I see how many active players the club has, how many are in a squad this season, how many have been picked for a match this season and how many are unverified.
- As a manager, I click "Unverified players" and see only the players waiting for me; the Status button on each card lets me verify or reject, so that I can deal with a registration request in a couple of clicks.
- As a manager, I suspend a player (deactivate) and reactivate them from the same Status button.
- As a manager, I reject a request by mistake and can still find that player and verify them.
- As a manager, I click "In a squad this season" or "Players selected this season" and the list narrows to those players; I click it again or "Active players" to go back.
- As a manager, suspended and rejected players are out of the way by default, and a switch brings them back.
- As a manager, I see on each card how many games the player has played this season and overall.
- As a manager, I switch to a list view to see many more players at once, and back to cards, and the app remembers my choice.
- As a manager, the Players toolbar, chips and phone Filters sheet behave exactly like Matches and Polls.
- As a section manager, the counters and the actions only cover players in my sections.

## Data Model Changes

`PlayerProfile` gains `verificationStatus`, a new enum `PlayerVerificationStatus { VERIFIED, UNVERIFIED, REJECTED }`, `NOT NULL`, **default `VERIFIED`** (every existing player, and every player a manager creates, is verified). Migration `backend/src/main/resources/db/changelog/v1/040-player-verification-status.sql` adds the column with that default and a `CHECK` on the three values. No other table changes. Games played needs no new storage: it is counted from the existing team selections (`MatchSidePlayer`).

Allowed transitions (anything else is a 409, `InvalidStatusTransitionException`): `UNVERIFIED → VERIFIED`, `UNVERIFIED → REJECTED`, `REJECTED → VERIFIED` (undo a mistaken reject). A verified player is never rejected (they are deactivated instead).

## Decisions to confirm

1. **Suspended and rejected players are hidden by default** (a "Show suspended and rejected players" switch, off). "Suspended" is the user-facing word for a deactivated player (the existing `active = false`, deactivate and reactivate endpoints are unchanged). Today the list shows everyone and marks inactive players with a badge. Hiding them matches Polls (closed polls) and Matches (past matches) and makes "Active players" the list's own total. **Unverified players are visible by default**, with an amber "Unverified" badge, so a request is never hidden from the manager. The alternative to hiding inactive players is to keep showing everyone and make "Active players" a quick filter instead of the reset card.
2. **"Selected" means picked into a match-day selection** (076, `MatchSidePlayer`): players who appear in the selection of at least one match of the default season, past or upcoming. It is not the same as being in the season squad (`TeamSquadMember`), which is the second counter, so the two are not duplicates. If they turn out to read the same, drop "In a squad this season" and keep "Players selected this season".
3. **Both season figures use the default season** (the season containing today, else the most recently created, `pickDefaultSeasonId`), chosen by the page and sent as `seasonId`; there is no season control. If the club has no season the two counters show 0 and are plain cards.
4. **"Active players" includes unverified players** (they are active, waiting) and excludes suspended and rejected ones.
5. A counter at zero is a plain card (the `PageCounters` rule), so "Unverified players" is a plain card until registration exists.
6. **"Games played" means selected for an active match that has started** (past or in progress), counted from the platform's own selections. The two numbers are "this season" (the default season, as the counters) and "overall" (every season). Nothing recorded before the club used the platform is counted, so "overall" reads "since you started using the platform", not career.
7. **Cards stay the default view**; the list is the alternative, and the choice is remembered per browser (the user did not say which should be the default).

## Counters (A)

Four `PageCounters` in `density="compact"`, all **filters** (`kind="filter"`, `aria-pressed`, the corner "FILTER" tag), four across from `md`, two by two on a phone.

| Counter | Figure | Tone | Action |
|---|---|---|---|
| Active players / Players shown | Players in the list: active and not rejected, or everyone with the switch on. Reads "Players shown" when suspended and rejected players are included | default | The reset: active by default, clears the quick filter |
| In a squad this season | Players in the list who are in at least one team squad for the default season | default | Toggles `focus=in-squad` |
| Players selected this season | Players in the list who are in the selection of at least one match of the default season | default | Toggles `focus=selected` |
| Unverified players | Players in the list with status `UNVERIFIED` | warning when above 0 | Toggles `focus=unverified` |

- **Follows the list's filters** (the 083 rule): Section, Missing date of birth and the Show switch narrow every figure; search does not; the quick filter itself does not (the first card stays a way back).
- A short "Showing: Vets › Over 40" scope under the title when a section is set, as on Matches.
- The quick filter shows as a removable chip, counts in the phone Filters badge, is named in the scope text ("Showing 3 players · Unverified players") and is cleared by "Clear all", by the first card and by choosing it again. At most one is active. Per visit, not persisted.
- Short labels on a phone: "Active", "In a squad", "Selected", "Unverified".

## Toolbar (B)

- **`FilterBar`** (`density="compact"`): Section (`SectionTreeSelect`, kept) and search ("Search by name"). Section is saved per club as today (`playerList:filters:<clubId>`), search never is.
- **`ContentControlsLine`:** scope "Showing N players" (with the quick filter's name when set) on the left; the sort link ("A to Z" / "Z to A") and two `CompactSwitch`es on the right: "Show suspended and rejected players" and "Missing date of birth" (the 077 filter, still saved). On a phone the switches and the sort link move into the Filters sheet; the Missing date of birth choice also shows as a chip and counts in the badge.
- Header unchanged: "Players" and "Add Player".

## Player card (C)

`PlayerCard` stays its own component (the person's photo avatar and cricket rows are not poll-card content) but takes the poll card's layout, with one rule on top: **every card has the same parts and the same height**, whatever is on file or what the player's status is.

| Area | Today | After |
|---|---|---|
| Avatar | 56 px circular photo or initials | Unchanged |
| Title | Single line, truncates beside the corner badges | Wraps, clamped to two lines (always fits beside the avatar) |
| Badges | Section chip(s), "No date of birth" and "Inactive" in the top-right corner | One left-aligned row **under** the header: the **status badge first, always** (Verified, Unverified, Rejected or Suspended), then the section chip (first plus `+N`), or a dashed "No section" when there is none |
| Details | Phone, batting, bowling icon rows, each omitted when absent | **Five fixed rows with the shared zebra tint, always present:** Number, Born, Phone, Bat, Bowl. A value that is not on file shows "–" in the secondary colour (so a missing date of birth is visible without a separate badge) |
| Footer | Edit only, right-aligned | **The same three equal columns on every card:** Status, Edit, View |

Status badge tones: Verified (green tint), Unverified (amber, the warning tone), Rejected (the closed tone), Suspended (muted). Cards in a row are equal height with the footer pinned; the whole card still opens the player. No button appears or disappears with the player's status.

**Status button.** One button, icon over the caption "Status", opens a menu headed "Status: <current>" with only the changes that are valid from the current status:

| Current status | Menu |
|---|---|
| Unverified | Verify, Reject |
| Verified | Suspend |
| Rejected | Verify |
| Suspended | Reactivate |

**Verify** and **Reactivate** act at once and the card and counters update. **Reject** and **Suspend** ask first in a `ConfirmDialog` ("Reject this player request? They will be hidden from the player list. You can still find them and verify them later." / "Suspend this player? They will be hidden from the player list and cannot be picked for matches until you reactivate them. Nothing is deleted.").

## Player status (D)

- A manager (club admin, or a section manager for a player in their sections) changes a player's status with the Status button on the card, and from the same button in the Player page header; for an unverified or rejected player the Player page also shows a banner above the details that says so and repeats the Change status button.
- Statuses and the one list of valid changes are in the table above. **Suspended** is the existing deactivated state (`active = false`), reached through the existing deactivate endpoint; **Reactivate** is the existing reactivate endpoint. Verified, Unverified and Rejected are the new `verificationStatus`. A suspended player keeps their verification status underneath.
- Rejected players leave the default list and every counter; "Show suspended and rejected players" brings them back with a "Rejected" badge, where the Status menu offers Verify.
- Nothing else changes for an unverified player yet (non-goals).

## Games played (E)

Two small stat chips in the card's top-right corner, stacked: **"12 this season"** over **"48 overall"** (each an outlined chip of the shared badge size). They are always present, "0" when the player has not played, so a card never changes height; they sit to the right of the title in the header row, and a long name wraps to two lines beside them. On the list view they are two columns. Counted as in Decisions to confirm, 6; the stat chips are plain text, not buttons, and carry an accessible name ("12 games this season").

## List view (F)

A **Cards | List** switch sits on the content line, left of the sort link on desktop and as the first control in the Filters sheet on a phone (a small segmented control, the same style as the Availability view switch). **The choice is remembered**: it is saved the moment it changes, per browser (`playerList:view`), not per club, and restored on the next visit, so each manager keeps the view they prefer; it never affects the counters, filters or the Status actions. It is built as a shared control and hook (`ListViewToggle` and `useListViewPreference(key, default)`, every `localStorage` access try/catch-guarded like `usePersistedListFilters`), not as Players-only code, because Matches and Polls will get the same switch (see the roadmap).

The list is one bordered panel of rows, the Players grid's language: a sticky header row, the shared zebra tint on alternate rows, 44 px minimum row height, the **whole row opens the player**, exactly like a card (the name is a stretched link over the row, so a click anywhere on the row navigates, and Enter on the focused row does too); the row tints on hover and shows a keyboard focus ring; the Status button at the end sits above that link, so using its menu never navigates. Columns on desktop: **Player** (small avatar and name), **Status** (the same badge), **Section** (first plus `+N`, or "No section"), **No.**, **Phone**, **Bat**, **Bowl**, **This season**, **Overall**, and a **Status** kebab button at the end opening the same `PlayerStatusMenu`. A value that is not on file shows "–". From `sm` down the list keeps **Player** (avatar, name, status badge under it), the two games columns and the kebab; the other columns drop. Loading, empty and error states are the page's own; rows are equal height.

## API Contract (outline, finalised in planning)

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/players/summary?sectionId&missingDateOfBirth&seasonId&includeInactive` | `@PreAuthorize("@access.canAccessClub(authentication, #clubId)")`, section-scoped exactly as the list | `PlayersSummaryDto { playersShown, inSquad, selected, unverified }` |
| `GET /api/v1/manage/clubs/{clubId}/players` | unchanged | Gains optional `includeInactive` (default `true`, so every existing caller is unchanged and still gets everyone; the Players page sends `false`, which also hides rejected players), `focus` (`in-squad`, `selected` or `unverified`, case-insensitive, anything else 400) and `seasonId` (the season the first two look at; one of them without a `seasonId` is a 400) |
| `POST /api/v1/manage/clubs/{clubId}/players/{playerId}/verify` | `canAccessClub` plus `assertCanAdministerAnySection` on the player's sections, as deactivate | `PlayerDto` with status `VERIFIED`; 409 if already verified |
| `POST /api/v1/manage/clubs/{clubId}/players/{playerId}/reject` | same | `PlayerDto` with status `REJECTED`; 409 unless currently `UNVERIFIED` |
| `POST …/players/{playerId}/deactivate` and `…/reactivate` | existing, unchanged | The Status menu's Suspend and Reactivate |

- `PlayerDto` gains `verificationStatus`, `gamesThisSeason` and `gamesOverall`. The two counts come from one grouped query each over the loaded roster (`MatchSidePlayer` through `MatchSide` to an active `Match` that has started: `count(distinct match)` per player), the first only when `seasonId` is given (else `gamesThisSeason` is 0); a fixed statement count, never a lookup per player. The list sends `seasonId` on every request now, so the existing parameter does double duty. `CreatePlayerRequest` and `UpdatePlayerRequest` do **not** (a manager never sets it by hand; the future registration flow creates profiles as `UNVERIFIED` through its own path).
- `playersShown` equals the list's size and `inSquad` / `selected` / `unverified` equal its size with that `focus` (and `seasonId`), for the same filters; all come from one shared definition in `PlayerServiceImpl`. Squad membership is `TeamSquadMember` rows for the season; selection is `MatchSidePlayer` rows (through `MatchSide`) of matches in that season.
- Section scoping, the lookups batched once (never per player), a fixed statement count, `openapi.yaml` additions only.

## UI Requirements

- Composed from existing components: `PageCounters` (four items, short labels), `FilterBar`, `ContentControlsLine`, `CompactSwitch`, `SortLink`, `DetailLine`, `ConfirmDialog`, `badgeSx`, the shared zebra tint, `ManageScreenHeader`. New code is the Players wiring, `PlayerCard`'s new layout and Status button and menu, the banner and Status button on the detail page, and the summary and verify/reject clients.
- Mobile first: counters two by two, the list view with its reduced columns, the toolbar behind Filters (badge, chips, sheet), the card footer never clips at 375 px (three equal columns on every card).
- Storybook: a `PlayerList` row/table story set (all statuses, nothing on file, narrow); `PlayerCard` stories updated (long name, several sections, nothing on file, suspended, unverified, rejected, verified), all rendering at the same height.
- A mockup in the app's real tokens (desktop page, card before and after and per status, counter states, the status menu and its confirmations, phone, sheet) is reviewed and approved by the user before any slice starts.

## Test Plan

Per `docs/standards/testing.md`:
- **Frontend:** `PlayerList` (counters from the summary and their filters, each quick filter sends `focus` and `seasonId`, chip, badge, scope text, reset and toggle, zero rule, amber Unverified, failed summary hides the row, switch default off sending `includeInactive`, Missing date of birth switch persisted, Clear all, phone sheet), `PlayerCard` (the two games chips always present, "0" when none; status badge always first, the five fixed rows with "–" for absent values, the same footer for every status, equal height, the Status menu per status and its calls, Reject and Suspend confirm dialogs, Verify and Reactivate act at once), the detail-page banner, `PageCounters` four items; the list view (columns, the same Status menu per row, reduced columns on a phone, the switch remembered in `playerList:view` (changing it saves at once; a reload and a fresh visit restore it), the same filters and counters in both views).
- **Backend:** summary (definitions incl. inactive, rejected and unverified players, a player in two squads or two selections counted once, a squad or match of another season, a selected player who is in no squad, games played (a past match counted, an upcoming or deactivated match not, a player in two matches of two seasons, "overall" across seasons, 0 without a season), section-manager scoping, another club 403, statement count); list `includeInactive` and `focus`; verify and reject (transitions and the 409s, section scoping, cross-club 404); the migration defaults existing rows to `VERIFIED`; counters equal list totals (parity).
- **Contract:** `openapi.yaml` additions only.

## Acceptance Criteria

- Players shows the four counters, figures equal to the list for the same filters; "Unverified players" is amber above zero and a plain card at zero.
- Choosing a counter narrows the list, shows as a chip, in the scope text and in the phone badge; the first card, choosing it again or Clear all resets it.
- A manager can verify or reject an unverified player, suspend a verified one and reactivate a suspended one, all from the one Status button on the card or the player page; a rejected player leaves the list and counters until the switch is on, and can then be verified.
- Suspended and rejected players are hidden until the switch is on; the first counter then reads "Players shown".
- Existing players and manager-created players are `VERIFIED`; the Players endpoints other than the new ones behave as before for every existing caller.
- The toolbar, chips and phone sheet match Matches; Missing date of birth is a switch and a chip.
- Every player card has the same height and the same parts: status badge and section, five zebra rows ("–" when absent) and the Status, Edit, View footer; no button appears or disappears with the status.
- Each card shows "N this season" and "N overall" in its top-right corner, always present, and the numbers match the player's selections in past, active matches.
- A row opens the player when clicked anywhere except the Status button, and the Status menu opens without navigating.
- A Cards | List switch changes the layout only; the list view shows the columns above, the same Status menu per row and the same filters and counters, and the choice is remembered.
- Section managers only see and act on their sections' players, in list, counters and actions; a failed summary hides the counters and the list still works.

## Open Questions

- The default for inactive players (Decisions to confirm, 1) and the meaning of "selected" (2).
- Whether "View" is wanted as a footer button when the whole card already opens the player.
- Whether the list view should become the default on desktop, and whether its games columns should be sortable later.
- Whether a verified player should also be rejectable (today only deactivated, i.e. suspended).
- When registration lands: whether an unverified player should be blocked from squads, selections and polls, and whether the requester is told of the outcome (both out of scope here).

## Rollout Notes

Slices, one branch, each reviewable on its own: (1) the mockup for review; (2) `PageCounters` (four items), the toolbar and the card without verification (frontend only); (3) the backend: migration 040, the games-played counts, `verificationStatus`, verify and reject, the summary endpoint, `includeInactive` and `focus` / `seasonId`; (4) the counters, the Unverified counter, the Status button and menu on the card and the Player page, the games-played chips and the list view. Add a pointer in `docs/roadmap.md` ("Counters on other pages", and a new "Player self-registration" item) when this is approved.
