# 088 — Players Aligned With Polls

**Depends on:** 028 (players), 060 and 061 (player detail and `PlayerCard`), 077 (date of birth and the Missing date of birth filter), 081 (page counters), 083–085 (`FilterBar`, `ContentControlsLine`, compact density, clickable counters), 087 (the Matches version of this same work: `PageCounters` short labels, `CardTimeStrip`, shared zebra tint, the summary endpoint pattern)
**Status:** draft — written 2026-10-09 from the user's request ("Start on the Players counters"). Decided by the user the same day: the counters are **Active players** and **In a squad this season**; their figures come from a **backend summary endpoint**; the scope is **counters, toolbar and card** (the Matches treatment). No mockup yet, nothing built. Backend contract is an outline to finalise in planning.

## Problem & Goals

The Players page is the other list a manager lives in, and it is still the pre-polish version of the screen: no counters, the old `ListToolbar` with a "Missing date of birth" chip stacked under the Section picker, and a bespoke `PlayerCard` whose badges sit in the top-right corner beside a truncated name. The two figures a manager wants at a glance, how many active players there are and how many of them are actually in a squad this season, are not shown anywhere. 081 listed four proposed Players counters; the user chose two. "Missing date of birth" stays a filter (it already exists, 077) and "New this month" is dropped.

Goals:
- **A. Counters:** two clickable counters under the header, in the Polls and Matches style.
- **B. Toolbar:** `FilterBar` and `ContentControlsLine` on Players, as on Matches.
- **C. Player card:** the poll card's layout (badges under the header, subtitle, zebra detail rows), keeping the player's photo avatar.

## Non-goals

- **No "Missing date of birth" or "New this month" counter.** The first remains a switch (077's filter, moved to the content line); the second is dropped. Either can come back later by the two-kind rule (084).
- **No pagination.** The roster is a small bounded list (028); it stays fetched in full and searched by name in the browser. The quick filter and the Show inactive switch are backend parameters like Section and Missing date of birth, so the counters and the list share one definition.
- **No League, Season or Team filter on Players.** They do not describe a player; the squad figure uses the default season behind the scenes (below).
- **No change to what a player is**, the Player detail page, the player form, sections tagging, or the public availability form. No new player fields.
- **No server-side search**, so the counters do not follow the search box (the same decision as 083 for Polls).

## User Stories

- As a manager, I see how many active players the club has and how many of them are in a squad this season, so that I know who is not in any team.
- As a manager, I click "In a squad this season" and the list narrows to those players; I click it again or "Active players" to go back.
- As a manager, inactive players are out of the way by default, and a "Show inactive players" switch brings them back so I can reactivate one.
- As a manager, the Players toolbar, chips and phone Filters sheet behave exactly like Matches and Polls.
- As a manager, a player card reads like the poll and match cards: name, badges, sections and the details I need at a glance.
- As a section manager, the counters count only players in my sections.

## Data Model Changes

None.

## Decisions to confirm

1. **Inactive players are hidden by default** (new "Show inactive players" switch, off). Today the list shows everyone and marks inactive players with a badge. Hiding them matches Polls (closed polls) and Matches (past matches) and makes "Active players" the list's own total. This is a change of default behaviour; the alternative is to keep showing everyone and make "Active players" a quick filter instead of the reset card.
2. **The squad figure uses the default season** (the season containing today, else the most recently created, `pickDefaultSeasonId`), chosen by the page and sent as `seasonId`; there is no season control. If the club has no season the counter shows 0 and is a plain card.
3. A counter at zero is a plain card (the `PageCounters` rule).

## Counters (A)

Two `PageCounters` in `density="compact"`, both **filters** (`kind="filter"`, `aria-pressed`, the corner "FILTER" tag).

| Counter | Figure | Action |
|---|---|---|
| Active players / Players shown | Players in the list: active only, or everyone with Show inactive on. Reads "Players shown" when inactive players are included | The reset: active by default, clears the quick filter |
| In a squad this season | Players in the list who are members of at least one team squad for the default season | Toggles the quick filter (`inSquad`) |

- **Follows the list's filters** (the 083 rule): Section, Missing date of birth and Show inactive narrow both figures; search does not; the quick filter itself does not (the first card stays a way back).
- A short "Showing: Vets › Over 40" scope under the title when a section is set, as on Matches.
- The quick filter shows as a removable chip, counts in the phone Filters badge, is named in the scope text ("Showing 14 players · In a squad this season") and is cleared by "Clear all", by the first card and by choosing it again. Per visit, not persisted.
- With two counters the row is two cards wide on desktop (`PageCounters` gains a column count equal to its items, up to four) and two across on a phone. Short labels on a phone: "Active" and "In a squad".

## Toolbar (B)

- **`FilterBar`** (`density="compact"`): Section (`SectionTreeSelect`, kept) and search ("Search by name"). Section is saved per club as today (`playerList:filters:<clubId>`), search never is.
- **`ContentControlsLine`:** scope "Showing N players" (with the quick filter's name when set) on the left; the sort link ("A to Z" / "Z to A") and two `CompactSwitch`es on the right: "Show inactive players" and "Missing date of birth" (the 077 filter, still saved). On a phone the switches and the sort link move into the Filters sheet; the Missing date of birth choice also shows as a chip and counts in the badge.
- Header unchanged: "Players" and "Add Player".

## Player card (C)

`PlayerCard` stays its own component (the person's photo avatar and cricket rows are not poll-card content) but takes the poll card's layout:

| Area | Today | After |
|---|---|---|
| Avatar | 56 px circular photo or initials | Unchanged |
| Title | Single line, truncates beside the corner badges | Wraps up to three lines |
| Badges | Section chip(s), "No date of birth" and "Inactive" in the top-right corner | A left-aligned row **under** the header, same tones: section chips (first plus `+N`), "No date of birth" (warning), "Inactive" (muted) |
| Subtitle | Jersey chip under the name | `#12 · Right-handed bat` style line when there is a number or stance; omitted when empty |
| Details | Phone, batting, bowling icon rows | Phone, Bat, Bowl as `DetailLine` rows with the shared zebra tint, each omitted when absent |
| Footer | Edit only, right-aligned | A pinned footer row, icon over caption, equal columns: Edit, View |

Cards in a row are equal height with the footer pinned; the whole card still opens the player.

## API Contract (outline, finalised in planning)

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/players/summary?sectionId&missingDateOfBirth&seasonId&includeInactive` | `@PreAuthorize("@access.canAccessClub(authentication, #clubId)")`, section-scoped exactly as the list | `PlayersSummaryDto { playersShown, inSquad }` |
| `GET /api/v1/manage/clubs/{clubId}/players` | unchanged | Gains optional `includeInactive` (default `true`, so every existing caller is unchanged; the Players page sends `false`) and `squadSeasonId` (only players in a team squad for that season) |

- `playersShown` equals the list's size and `inSquad` equals the size with `squadSeasonId`, for the same filters; both come from one shared definition in `PlayerServiceImpl`.
- Section scoping, the two lookups batched once (never per player), a fixed statement count, `openapi.yaml` additions only. Squad membership is `TeamSquadMember` rows for the season.

## UI Requirements

- Composed from existing components: `PageCounters` (+ a column count), `FilterBar`, `ContentControlsLine`, `CompactSwitch`, `SortLink`, `DetailLine`, `badgeSx`, the shared zebra tint, `ManageScreenHeader`. New code is the Players wiring, `PlayerCard`'s new layout, and the summary client.
- Mobile first: counters two across, the toolbar behind Filters (badge, chips, sheet), the card footer never clips at 375 px.
- Storybook: `PlayerCard` stories updated (long name, many sections, no optional data, inactive, no date of birth), `PageCounters` two-item variant.
- A mockup in the app's real tokens (desktop page, card before and after, counters states, phone, sheet) is reviewed and approved by the user before any slice starts.

## Test Plan

Per `docs/standards/testing.md`:
- **Frontend:** `PlayerList` (counters from the summary and their filters, quick filter sends `squadSeasonId`, chip, badge, scope text, reset and toggle, zero rule, failed summary hides the row, Show inactive default off and sending `includeInactive`, Missing date of birth switch persisted, Clear all, phone sheet), `PlayerCard` (badge row under the header, subtitle, zebra rows, footer, absent fields), `PageCounters` column count.
- **Backend:** summary (definitions incl. inactive players, a player in two squads counted once, a squad of another season, section-manager scoping, another club 403, statement count), list `includeInactive` and `squadSeasonId`, parity of the counters with the list totals.
- **Contract:** `openapi.yaml` additions only.

## Acceptance Criteria

- Players shows "Active players" and "In a squad this season", figures equal to the list for the same filters.
- Choosing the squad counter narrows the list, shows as a chip, in the scope text and in the phone badge; the first card, choosing it again or Clear all resets it.
- Inactive players are hidden until Show inactive players is on; the first counter then reads "Players shown".
- The toolbar, chips and phone sheet match Matches; Missing date of birth is a switch and a chip.
- The player card has the badge row under the header, wraps long names, shows zebra detail rows and a pinned Edit / View footer.
- Section managers only see their sections' players in list and counters; a failed summary hides the counters and the list still works.

## Open Questions

- The default for inactive players (Decisions to confirm, 1).
- Whether "View" is wanted as a footer button when the whole card already opens the player.

## Rollout Notes

Slices, each reviewable on its own, one branch: (1) the mockup for review; (2) `PageCounters` column count, then the toolbar and the card (frontend only); (3) the summary endpoint, `includeInactive`, `squadSeasonId` and the counters. Add a pointer in `docs/roadmap.md` ("Counters on other pages") when this is approved.
