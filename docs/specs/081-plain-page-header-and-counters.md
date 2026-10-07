# 081 — Plain Page Header and Page Counters

**Depends on:** 046 (header and body elevation standard, which this spec amends), 079 (manager shell and Overview, whose key figures this reuses), 073 and 074 (availability hub), 077 (player date of birth)
**Status:** draft — look approved by the user on 2026-10-06 from https://claude.ai/artifact/49HHkryVQeuZGv6Hdt4oxk (header, option A, plain) and https://claude.ai/artifact/SrcEtr8UJ3DQs3hX8XVQaM (counters). The user knows this goes against spec 046 and wants it. The counters per page beyond Availability are examples to be agreed page by page.

## Problem & Goals

Every inner page shares one header band: white, a 3px green accent line on top, rounded bottom corners, a shadow, pulled flush to the edges of the page. Beside the new side menu it looks cut off, and it does not match the plain Overview header. The user also wants each page to show a few counters, like the Overview's key figures, so a manager sees what needs attention before reading the list.

Goals:
- One clean header on every page: the title on the left, the page actions on the right, sitting directly on the page, like the Overview.
- A shared counters row, in the Overview card style, under the header on list pages.
- Counters that can double as quick filters and turn amber when something needs attention.
- Counters scoped to what the signed-in manager can see (same section rules as the Overview).

## Non-goals

- Changing page content, filters, cards or tabs beyond adding the counters row.
- Dashboard (Overview) content: it already has its own key figures.
- Counters on every page at once. Each page's list is agreed and built separately; only Availability, Players and Matches are listed here.
- A new design for detail and edit screens beyond the header treatment.

## User Stories

- As a manager, every page opens with the same plain header (title left, buttons right), so the app feels consistent.
- As a manager on the Availability page, I see how many polls are open, how many players have responded, how many answers are still awaited and which polls close soon.
- As a manager on the Players page, I see how many players are active, how many are in a squad, and how many are missing a date of birth, and I can tap that counter to filter the list.
- As a manager on the Matches page, I see this week's matches, teams not yet announced and matches without a poll.
- As a section manager, the counters only count what is in my sections.

## Data Model Changes

None.

## API Contract

Each page with counters gets one small read-only summary endpoint under the manager area, scoped to the caller with `AccessService.accessibleSectionIds` exactly like the Overview endpoint (079), `@PreAuthorize("@access.canAccessClub(authentication, #clubId)")`, a fixed number of queries, flat record DTOs, `openapi.yaml` additions only.

| Page | Endpoint | Returns |
|---|---|---|
| Availability | `GET /api/v1/manage/clubs/{clubId}/availability/summary` | `openPolls`, `playersResponded`, `playersInAudience`, `answersAwaited`, `closingSoon` (open polls closing within 48 hours) |
| Players | `GET /api/v1/manage/clubs/{clubId}/players/summary` | `active`, `inSquadThisSeason`, `missingDateOfBirth`, `newThisMonth` |
| Matches | `GET /api/v1/manage/clubs/{clubId}/matches/summary` | `thisWeek`, `teamsNotAnnounced`, `withoutPoll`, `playedThisSeason` |

Definitions (to confirm during planning): "players responded" counts distinct players in the audience of any open poll who have at least one answer other than no response, against distinct players in the audience of any open poll; "answers awaited" is the number of open-poll answers still no response (the Overview already computes the same figure); "this week" is today to today plus 7 days as in the Overview.

## UI Requirements

**Header.** `PageHeaderBand` (used by `RecordDetailScreen`, `RecordFormScreen`, `ManageScreenHeader` and the league view layout, in every shell) becomes plain: transparent, no accent line, no shadow, no rounded corners, no negative bleed margin. The title sits on the left (bold, about 1.3 rem), actions on the right, a back link above the title only on detail and edit pages (spec 079's rule), and a small bottom gap before the content. A page tab switch (Availability hub, league views) stays between the title and the actions. On a phone the title, switch and actions stack as they do today. Spec 046 and `docs/standards/design-system.md` are amended to describe this.

**Counters row.** A shared component `PageCounters` (four-file anatomy), not page-specific markup: an array of `{ id, value, label, tone: 'default' | 'warning', hint?, active?, onSelect? }`. It renders cards in the same style as the Overview key figures (white card, the shared card shadow, value about 1.5 rem, small label), four across on desktop and two by two on a phone. The `active` counter has a subtle outline (the one the list below is filtered to); a `warning` counter's value uses the warning colour; a counter with `onSelect` is a button (keyboard and screen reader friendly, `aria-pressed` when active) that applies its filter to the list and a "Tap to filter" hint. It shows a calm placeholder while loading and hides itself if the summary fails (the page still works).

**Pages.** Availability (Polls tab, Players and Coverage tabs keep their own content for now): open polls, players responded as "31 / 46", answers awaited (warning when above zero), close in 48 hours (warning when above zero). Players: active players, in a squad this season, missing a date of birth (warning, tap to filter, reuses the filter from 077), new this month. Matches: this week, team not announced (warning), without a poll (warning), played this season. Exact labels and any additional pages are agreed with the user before each slice.

## Test Plan

Per `docs/standards/testing.md`:
- Frontend: `PageHeaderBand` and its consumers (layout without negative margins or accent), existing page tests updated only where they assert the old band; `PageCounters` (values, tones, active outline, button behaviour and keyboard, loading and error states, two-column phone layout), each page's counters wired to its summary and its filter.
- Backend per summary endpoint: unit tests for the definitions and edge cases (no polls, nothing responded, week boundaries), Testcontainers integration (200 shape, another club 403, section-manager scoping), a statement-count guard.
- Storybook stories for `PageCounters` and the new header.

## Acceptance Criteria

- Every page header, in every shell, is plain: no accent line, shadow, rounded corners or bleed, title left and actions right.
- The Availability, Players and Matches pages each show their counters under the header with the correct numbers for the manager's scope.
- A counter with a filter applies that filter when tapped and shows as active.
- Counters never show another section's data to a section manager.
- If a summary request fails, the list still works and the counters row hides.

## Open Questions

- The exact counters for each page beyond the three examples (agree page by page).
- The definition of "players responded" (see API Contract) and the 48-hour "closing soon" window.

## Rollout Notes

Slices, each its own PR: (1) the plain header and the doc amendments (frontend only, all pages at once); (2) `PageCounters` and the Availability counters with their summary endpoint; (3) Players counters; (4) Matches counters; further pages later, each after agreeing its counters.
