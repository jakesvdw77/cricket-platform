# 088 — Players Aligned With Polls, and Player Verification

**Depends on:** 028 (players), 060 and 061 (player detail and `PlayerCard`), 076 (team selection), 077 (date of birth and the Missing date of birth filter), 081 (page counters), 083–085 (`FilterBar`, `ContentControlsLine`, compact density, clickable counters), 087 (the Matches version of this same work: `PageCounters` short labels, `CardTimeStrip`, shared zebra tint, the summary endpoint pattern)
**Status:** draft — written 2026-10-09 from the user's request ("Start on the Players counters"), revised the same day. Decided by the user: four counters (**Active players**, **In a squad this season**, **Players selected this season**, **Unverified players**), their figures from a **backend summary endpoint**, a new **verification status** on the player with **Verify and Reject** actions, **Reject marks the player Rejected and hides them**, and the scope **counters, toolbar and card** (the Matches treatment). No mockup yet, nothing built. Backend contract is an outline to finalise in planning.

## Problem & Goals

The Players page is the other list a manager lives in, and it is still the pre-polish version of the screen: no counters, the old `ListToolbar` with a "Missing date of birth" chip stacked under the Section picker, and a bespoke `PlayerCard` whose badges sit in the top-right corner beside a truncated name. The figures a manager wants at a glance are not shown anywhere: how many players are active, how many are in a squad, how many have actually been picked to play, and (new) how many are waiting to be verified.

The verification part looks ahead. Later, parents and players will create the player profile themselves; such a profile arrives **unverified** and the manager verifies or rejects the request. That self-registration flow is not part of this spec, but the status, the counter and the manager's Verify and Reject actions are, so the manager side is ready when it lands. Until then every player is verified and the counter reads 0.

Goals:
- **A. Counters:** four clickable counters under the header, in the Polls and Matches style.
- **B. Toolbar:** `FilterBar` and `ContentControlsLine` on Players, as on Matches.
- **C. Player card:** the poll card's layout (badges under the header, subtitle, zebra detail rows), keeping the player's photo avatar.
- **D. Verification:** a `verificationStatus` on the player, a clickable amber "Unverified players" counter, and Verify and Reject on the card and the player page.

## Non-goals

- **No self-registration flow** (parents or players creating a profile), no notification to whoever requested the profile, and no rule yet that keeps unverified players out of squads, selections or polls. All of that arrives with registration; here the status is only set, shown, filtered and changed by a manager.
- **No audit history** beyond the player's existing `updatedAt` / `updatedBy`.
- **No "Joined recently" or "Missing date of birth" counter.** Missing date of birth stays a switch (077's filter, moved to the content line).
- **No pagination.** The roster is a small bounded list (028); it stays fetched in full and searched by name in the browser. The quick filter and the Show inactive switch are backend parameters like Section and Missing date of birth, so the counters and the list share one definition.
- **No League, Season or Team filter on Players.** They do not describe a player; the two season figures use the default season behind the scenes (below).
- **No change to the Player detail page beyond the verification banner and actions, the player form, section tagging, or the public availability form.** No other new player fields.
- **No server-side search**, so the counters do not follow the search box (the same decision as 083 for Polls).

## User Stories

- As a manager, I see how many active players the club has, how many are in a squad this season, how many have been picked for a match this season and how many are unverified.
- As a manager, I click "Unverified players" and see only the players waiting for me, each with Verify and Reject buttons, so that I can deal with a registration request in a couple of clicks.
- As a manager, I reject a request by mistake and can still find that player and verify them.
- As a manager, I click "In a squad this season" or "Players selected this season" and the list narrows to those players; I click it again or "Active players" to go back.
- As a manager, inactive and rejected players are out of the way by default, and a switch brings them back.
- As a manager, the Players toolbar, chips and phone Filters sheet behave exactly like Matches and Polls.
- As a section manager, the counters and the actions only cover players in my sections.

## Data Model Changes

`PlayerProfile` gains `verificationStatus`, a new enum `PlayerVerificationStatus { VERIFIED, UNVERIFIED, REJECTED }`, `NOT NULL`, **default `VERIFIED`** (every existing player, and every player a manager creates, is verified). Migration `backend/src/main/resources/db/changelog/v1/040-player-verification-status.sql` adds the column with that default and a `CHECK` on the three values. No other table changes.

Allowed transitions (anything else is a 409, `InvalidStatusTransitionException`): `UNVERIFIED → VERIFIED`, `UNVERIFIED → REJECTED`, `REJECTED → VERIFIED` (undo a mistaken reject). A verified player is never rejected (they are deactivated instead).

## Decisions to confirm

1. **Inactive and rejected players are hidden by default** (a "Show inactive and rejected players" switch, off). Today the list shows everyone and marks inactive players with a badge. Hiding them matches Polls (closed polls) and Matches (past matches) and makes "Active players" the list's own total. **Unverified players are visible by default**, with an amber "Unverified" badge, so a request is never hidden from the manager. The alternative to hiding inactive players is to keep showing everyone and make "Active players" a quick filter instead of the reset card.
2. **"Selected" means picked into a match-day selection** (076, `MatchSidePlayer`): players who appear in the selection of at least one match of the default season, past or upcoming. It is not the same as being in the season squad (`TeamSquadMember`), which is the second counter, so the two are not duplicates. If they turn out to read the same, drop "In a squad this season" and keep "Players selected this season".
3. **Both season figures use the default season** (the season containing today, else the most recently created, `pickDefaultSeasonId`), chosen by the page and sent as `seasonId`; there is no season control. If the club has no season the two counters show 0 and are plain cards.
4. **"Active players" includes unverified players** (they are active, waiting) and excludes inactive and rejected ones.
5. A counter at zero is a plain card (the `PageCounters` rule), so "Unverified players" is a plain card until registration exists.

## Counters (A)

Four `PageCounters` in `density="compact"`, all **filters** (`kind="filter"`, `aria-pressed`, the corner "FILTER" tag), four across from `md`, two by two on a phone.

| Counter | Figure | Tone | Action |
|---|---|---|---|
| Active players / Players shown | Players in the list: active and not rejected, or everyone with the switch on. Reads "Players shown" when inactive and rejected players are included | default | The reset: active by default, clears the quick filter |
| In a squad this season | Players in the list who are in at least one team squad for the default season | default | Toggles `focus=in-squad` |
| Players selected this season | Players in the list who are in the selection of at least one match of the default season | default | Toggles `focus=selected` |
| Unverified players | Players in the list with status `UNVERIFIED` | warning when above 0 | Toggles `focus=unverified` |

- **Follows the list's filters** (the 083 rule): Section, Missing date of birth and the Show switch narrow every figure; search does not; the quick filter itself does not (the first card stays a way back).
- A short "Showing: Vets › Over 40" scope under the title when a section is set, as on Matches.
- The quick filter shows as a removable chip, counts in the phone Filters badge, is named in the scope text ("Showing 3 players · Unverified players") and is cleared by "Clear all", by the first card and by choosing it again. At most one is active. Per visit, not persisted.
- Short labels on a phone: "Active", "In a squad", "Selected", "Unverified".

## Toolbar (B)

- **`FilterBar`** (`density="compact"`): Section (`SectionTreeSelect`, kept) and search ("Search by name"). Section is saved per club as today (`playerList:filters:<clubId>`), search never is.
- **`ContentControlsLine`:** scope "Showing N players" (with the quick filter's name when set) on the left; the sort link ("A to Z" / "Z to A") and two `CompactSwitch`es on the right: "Show inactive and rejected players" and "Missing date of birth" (the 077 filter, still saved). On a phone the switches and the sort link move into the Filters sheet; the Missing date of birth choice also shows as a chip and counts in the badge.
- Header unchanged: "Players" and "Add Player".

## Player card (C)

`PlayerCard` stays its own component (the person's photo avatar and cricket rows are not poll-card content) but takes the poll card's layout:

| Area | Today | After |
|---|---|---|
| Avatar | 56 px circular photo or initials | Unchanged |
| Title | Single line, truncates beside the corner badges | Wraps up to three lines |
| Badges | Section chip(s), "No date of birth" and "Inactive" in the top-right corner | A left-aligned row **under** the header, same tones: **Unverified** (warning) or **Rejected** (closed tone) first when set, then section chips (first plus `+N`), "No date of birth" (warning), "Inactive" (muted) |
| Subtitle | Jersey chip under the name | `#12 · Right-handed bat` style line when there is a number or stance; omitted when empty |
| Details | Phone, batting, bowling icon rows | Phone, Bat, Bowl as `DetailLine` rows with the shared zebra tint, each omitted when absent |
| Footer | Edit only, right-aligned | Equal columns, icon over caption: **Verified:** Edit, View. **Unverified:** Verify, Reject, Edit, View. **Rejected:** Verify, Edit, View |

Cards in a row are equal height with the footer pinned; the whole card still opens the player. **Verify** acts at once and the card updates (the counters refresh); **Reject** asks first in a `ConfirmDialog` ("Reject this player request? They will be hidden from the player list. You can still find them and verify them later.").

## Verification (D)

- A manager (club admin, or a section manager for a player in their sections) can verify or reject, on the card and on the Player detail page, where an unverified or rejected player shows a banner with the same buttons.
- Unverified and Rejected players show their status badge wherever the card appears.
- Rejected players leave the default list and every counter; "Show inactive and rejected players" brings them back with a "Rejected" badge and a Verify button.
- Nothing else changes for an unverified player yet (non-goals).

## API Contract (outline, finalised in planning)

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/players/summary?sectionId&missingDateOfBirth&seasonId&includeInactive` | `@PreAuthorize("@access.canAccessClub(authentication, #clubId)")`, section-scoped exactly as the list | `PlayersSummaryDto { playersShown, inSquad, selected, unverified }` |
| `GET /api/v1/manage/clubs/{clubId}/players` | unchanged | Gains optional `includeInactive` (default `true`, so every existing caller is unchanged and still gets everyone; the Players page sends `false`, which also hides rejected players), `focus` (`in-squad`, `selected` or `unverified`, case-insensitive, anything else 400) and `seasonId` (the season the first two look at; one of them without a `seasonId` is a 400) |
| `POST /api/v1/manage/clubs/{clubId}/players/{playerId}/verify` | `canAccessClub` plus `assertCanAdministerAnySection` on the player's sections, as deactivate | `PlayerDto` with status `VERIFIED`; 409 if already verified |
| `POST /api/v1/manage/clubs/{clubId}/players/{playerId}/reject` | same | `PlayerDto` with status `REJECTED`; 409 unless currently `UNVERIFIED` |

- `PlayerDto` gains `verificationStatus`. `CreatePlayerRequest` and `UpdatePlayerRequest` do **not** (a manager never sets it by hand; the future registration flow creates profiles as `UNVERIFIED` through its own path).
- `playersShown` equals the list's size and `inSquad` / `selected` / `unverified` equal its size with that `focus` (and `seasonId`), for the same filters; all come from one shared definition in `PlayerServiceImpl`. Squad membership is `TeamSquadMember` rows for the season; selection is `MatchSidePlayer` rows (through `MatchSide`) of matches in that season.
- Section scoping, the lookups batched once (never per player), a fixed statement count, `openapi.yaml` additions only.

## UI Requirements

- Composed from existing components: `PageCounters` (four items, short labels), `FilterBar`, `ContentControlsLine`, `CompactSwitch`, `SortLink`, `DetailLine`, `ConfirmDialog`, `badgeSx`, the shared zebra tint, `ManageScreenHeader`. New code is the Players wiring, `PlayerCard`'s new layout and footer, the verification banner on the detail page, and the summary and verify/reject clients.
- Mobile first: counters two by two, the toolbar behind Filters (badge, chips, sheet), the card footer never clips at 375 px (four equal columns for an unverified card).
- Storybook: `PlayerCard` stories updated (long name, many sections, no optional data, inactive, no date of birth, unverified, rejected).
- A mockup in the app's real tokens (desktop page, card before and after and per status, counter states, phone, sheet, reject dialog) is reviewed and approved by the user before any slice starts.

## Test Plan

Per `docs/standards/testing.md`:
- **Frontend:** `PlayerList` (counters from the summary and their filters, each quick filter sends `focus` and `seasonId`, chip, badge, scope text, reset and toggle, zero rule, amber Unverified, failed summary hides the row, switch default off sending `includeInactive`, Missing date of birth switch persisted, Clear all, phone sheet), `PlayerCard` (badge row under the header, subtitle, zebra rows, footers for the three statuses, absent fields, Verify and Reject calls, confirm dialog), the detail-page banner, `PageCounters` four items.
- **Backend:** summary (definitions incl. inactive, rejected and unverified players, a player in two squads or two selections counted once, a squad or match of another season, a selected player who is in no squad, section-manager scoping, another club 403, statement count); list `includeInactive` and `focus`; verify and reject (transitions and the 409s, section scoping, cross-club 404); the migration defaults existing rows to `VERIFIED`; counters equal list totals (parity).
- **Contract:** `openapi.yaml` additions only.

## Acceptance Criteria

- Players shows the four counters, figures equal to the list for the same filters; "Unverified players" is amber above zero and a plain card at zero.
- Choosing a counter narrows the list, shows as a chip, in the scope text and in the phone badge; the first card, choosing it again or Clear all resets it.
- A manager can verify or reject an unverified player from the card or the player page; a rejected player leaves the list and counters until the switch is on, and can then be verified.
- Inactive and rejected players are hidden until the switch is on; the first counter then reads "Players shown".
- Existing players and manager-created players are `VERIFIED`; the Players endpoints other than the new ones behave as before for every existing caller.
- The toolbar, chips and phone sheet match Matches; Missing date of birth is a switch and a chip.
- The player card has the badge row under the header, wraps long names, shows zebra detail rows and a pinned footer for its status.
- Section managers only see and act on their sections' players, in list, counters and actions; a failed summary hides the counters and the list still works.

## Open Questions

- The default for inactive players (Decisions to confirm, 1) and the meaning of "selected" (2).
- Whether "View" is wanted as a footer button when the whole card already opens the player.
- When registration lands: whether an unverified player should be blocked from squads, selections and polls, and whether the requester is told of the outcome (both out of scope here).

## Rollout Notes

Slices, one branch, each reviewable on its own: (1) the mockup for review; (2) `PageCounters` (four items), the toolbar and the card without verification (frontend only); (3) the backend: migration 040, `verificationStatus`, verify and reject, the summary endpoint, `includeInactive` and `focus` / `seasonId`; (4) the counters, the Unverified counter, Verify and Reject on the card and the Player page. Add a pointer in `docs/roadmap.md` ("Counters on other pages", and a new "Player self-registration" item) when this is approved.
