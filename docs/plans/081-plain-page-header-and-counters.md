# Plan 081 — Plain Page Header and Page Counters

Implements `docs/specs/081-plain-page-header-and-counters.md` (draft; look approved from https://claude.ai/artifact/49HHkryVQeuZGv6Hdt4oxk header option A and https://claude.ai/artifact/SrcEtr8UJ3DQs3hX8XVQaM counters). Branch `feature/081-plain-header-and-counters` (holds the spec). **This plan covers slices 1 and 2** (the header, then `PageCounters` with the Availability counters). Players and Matches counters (slices 3 and 4) are planned when you ask for them, after the counters per page are agreed. Agents: `frontend-builder` for slice 1; `backend-builder` then `frontend-builder` for slice 2; tests written by the builders.

## Context

Inner pages share one header band (white, a 3px primary accent line on top, rounded bottom corners, shadow, negative margins pulling it flush to the edges), which looks cut off beside the new side menu and does not match the plain Overview. The user wants a plain header everywhere (title left, actions right) and Overview-style counters on list pages.

## Findings

- `components/PageHeaderBand/PageHeaderBand.tsx` is the only place the band styling lives: `mx/mt` negative margins, `bgcolor: background.paper`, bottom border, `boxShadow: headerBandShadow(theme)`, `borderTop` accent line, rounded bottom corners. `headerBandShadow` is exported from `theme.ts` and used by nothing else.
- Consumers: `RecordDetailScreen`, `RecordFormScreen`, `ManageScreenHeader` (components) and pages `ClubOverviewPage`, `MatchDetailPage`, `PlayerDetailPage`, `TeamDetailPage`, `league/LeagueViewLayout` (they wrap their own header in the band). Tests that assert the old band exist in `PageHeaderBand.test.tsx`, `ManageScreenHeader.test.tsx`, `RecordDetailScreen.test.tsx` and `RecordFormScreen.test.tsx`; stories in `PageHeaderBand.stories.tsx`.
- The band is also used under the admin and player shells (the same components), so changing it makes every page in every shell plain, as the user wants.
- `AvailabilityHubLayout` renders `ManageScreenHeader` (title, the Polls/Players/Coverage switch in `middle`, New poll as `action`) and an `Outlet`; the Polls view is `AvailabilityPollsDashboard`.
- For the Availability counters the backend already has, from 079: `OverviewPolls` (service.support) which batches squad and group poll counts of replied and total per open poll and applies the section scoping, and `AccessService.accessibleSectionIds`.

## Flags (decisions for you; none changes the spec)

1. **The Availability counters reuse the Overview's poll aggregation**, so "answers awaited" equals the Overview's figure by construction. "Players responded" is defined as in the spec (distinct players with at least one real answer over distinct players in the audience of any open poll).
2. **Counters appear on the Polls view only.** The hub's Players and Coverage views keep their own content and show no counters for now; the header stays the same on all three.
3. **Header title size** is matched to the Overview greeting (about 1.3 rem, bold), larger than today's `h6`, so pages and the Overview agree.
4. **`headerBandShadow` becomes unused** and is removed from `theme.ts` with its tests, to avoid dead code.

## Slice 1 (PR A): plain header (frontend only, `frontend-builder`)

- `PageHeaderBand` becomes a plain container: no background, border, shadow, accent line, rounded corners or negative margins; just a small bottom gap before the content (about `mb: 2` to `3`). Keep the component and its name so the five page wrappers and three shared screens need no structural change.
- Title typography: `ManageScreenHeader`, `RecordDetailScreen` and `RecordFormScreen` titles use the Overview greeting's size and weight; actions stay on the right; back link only on detail and edit pages (079 rule, unchanged); the Availability hub switch stays between title and action; phone stacking unchanged.
- Check each wrapper page (`ClubOverviewPage`, `MatchDetailPage`, `PlayerDetailPage`, `TeamDetailPage`, `LeagueViewLayout`) still reads well without the band (some place content directly under it and may relied on the white band for separation; add spacing, not a new background).
- Remove `headerBandShadow` from `theme.ts` if nothing else uses it.
- Docs: amend `docs/specs/046-header-body-elevation-standard.md` ("Amended by 081": the band is plain) and the `RecordDetailScreen`, `RecordFormScreen`, `ManageScreenHeader` rows and any band description in `docs/standards/design-system.md`.
- Tests: rewrite `PageHeaderBand.test.tsx` for the plain container (no accent, shadow, radius or negative margins; children rendered; identical under a club theme); update the assertions in `ManageScreenHeader`, `RecordDetailScreen` and `RecordFormScreen` tests; update the story. Existing page tests only where they depend on the band.

## Slice 2 (PR B): `PageCounters` and the Availability counters

**Backend (`backend-builder`, scratch-copy verification only).** `GET /api/v1/manage/clubs/{clubId}/availability/summary`, `@PreAuthorize("@access.canAccessClub(authentication, #clubId)")`. New `AvailabilitySummaryController`, `AvailabilitySummaryService` and `AvailabilitySummaryServiceImpl` (`@Transactional(readOnly = true)`), flat record `AvailabilitySummaryDto { openPolls, playersResponded, playersInAudience, answersAwaited, closingSoon }`. Reuse `OverviewPolls` and `AccessService.accessibleSectionIds` (extract a shared method if its current shape is overview-specific); `closingSoon` counts open polls with `scheduledCloseAt` within the next 48 hours; a fixed number of queries; `openapi.yaml` additions only. Tests: unit tests for the definitions and edge cases (no polls, nobody responded, 48-hour boundaries, group and squad both counted, a player in several polls counted once), Testcontainers integration (200 shape, another club 403, section manager scoping, empty club) and a statement-count guard.

**Frontend (`frontend-builder`, after the backend shape exists).**
- `ui/src/components/PageCounters/` (four-file anatomy): props `items: { id, value, label, tone?: 'default' | 'warning', hint?, active?, onSelect? }[]`, `loading?`; cards in the Overview key-figure style (reuse its card sx, extracted into a shared constant if the Overview page defines it inline; the Overview page then uses the shared pieces too), four across from `md`, two by two below; warning value colour; `active` outline; `onSelect` renders a button with `aria-pressed` and keyboard support; a quiet skeleton while loading. Stories and tests (values, tones, active, select by click and keyboard, loading, two-column layout).
- `ui/src/api/availabilitySummaryApi.ts` (React Query key `['managed-club', clubId, 'availability-summary']`); `AvailabilityHubLayout` renders `PageCounters` under the header for the Polls view only, hides the row if the request fails, and the counters refresh when polls change (the existing poll mutations invalidate the key). Counters: open polls (active), players responded as "N / M", answers awaited (warning above zero), close in 48 hours (warning above zero).
- Docs: `docs/standards/design-system.md` adds `PageCounters`. Tests for the wiring in `AvailabilityHubLayout`.

## Reuse (do not rewrite)
`OverviewPolls`, `AccessService.accessibleSectionIds`, the Overview key-figure card style, `usePersistedListFilters`/`ListToolbar` (counters with filters later), the 079 back-link rule.

## Out of scope
Players and Matches counters, counters on other pages, Overview content, any change to filters, cards or tabs.

## Verification
- Backend (slice 2): full `./mvnw -o clean test` in a fresh rsync'd scratch copy only.
- Frontend (Node 22 via nvm): `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint`, `npm run build`, the full unit suite, and the Storybook project on the touched stories. When the machine load is very high, the affected folders must pass alone.
- Manual (you), slice 1: Overview, Availability, Players list, a detail page (player, team, match), a form page, the league view and the admin and player shells, at 375 px and desktop: header plain, title left, buttons right, nothing cut off beside the menu. Slice 2: the counters on Availability against what you can count by hand, the amber states, the phone two-by-two layout.

## Commits and PRs
Slice 1: `feat(ui)` plain header, `test(ui)`, `docs`. Slice 2: `feat(backend)` summary endpoint, `test(backend)`, `feat(ui)` PageCounters and the Availability wiring, `docs`. Draft PRs, no merge until you say so.
