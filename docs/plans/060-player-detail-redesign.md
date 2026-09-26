# Plan — 060: Player Detail Redesign

## Context

`PlayerDetailPage.tsx` is the last `/manage` detail screen still built on the generic `RecordDetailScreen` shape (`ui/src/components/RecordDetailScreen/RecordDetailScreen.tsx`): Basic Info, Contact Info, Cricket Info, and Sections render as four full-width `ContentCard`s stacked vertically, wasting horizontal space on anything wider than a phone. `TeamDetailPage.tsx` already solved this in spec `057` with a bespoke header (chips under the name) + a two-column card grid. This plan implements spec `060` (`docs/specs/060-player-detail-redesign.md`, approved), which applies that same pattern to `PlayerDetailPage`, adds the player's Medical Aid fields (which exist on `Player` but were never shown on this screen), and reserves a placeholder Stats card for a future cricket-statistics feature. Approved design reference: the Claude Design canvas built earlier this session (https://claude.ai/artifact/EQA2Kk5HYREcqN5inZg4Gb).

This is a frontend-only change — no new entity, endpoint, or migration (confirmed in spec's Data Model Changes / API Contract, both "None"). No new shared component is introduced (confirmed in spec's Non-goals) — `PlayerDetailPage` becomes a bespoke page like `TeamDetailPage`, while `RecordDetailScreen`/`DetailFieldRow`/`DetailFieldGrid` stay unchanged for every other entity's detail page.

## Approach

### 1. Rewrite `ui/src/pages/manage/PlayerDetailPage.tsx` (frontend-builder)

Keep the existing data-fetching exactly as-is (`listPlayers` + client-side find-by-id, `listPlayerSections`, `listSections`, the `sectionsById`/`sectionPath()` helpers, `badgeFor`/`fullName` imported from `PlayerList.tsx`) — none of that changes. Only the render output changes, from `<RecordDetailScreen sections={[...]} />` to a bespoke structure mirroring `TeamDetailPage.tsx`:

- **Header** — `PageHeaderBand` (reused, unchanged) containing:
  - The existing "Back to Players" `MuiButton` (copy `RecordDetailScreen`'s own back-button markup, same as `TeamDetailPage` does for its own header).
  - Avatar (`player.photoUrl`, circular, `initialsFromName(fullName(player))` fallback — unchanged shape/size, 56px, from the current `RecordDetailScreen` header) + name (`Typography variant="h6" component="h1"`) + **a chip row directly under the name**: one outlined `Chip` per entry in `taggedSections.map(sectionPath)` (the section's full breadcrumb, exactly as already computed today, just relocated), plus the existing `badgeFor(player)` Inactive badge in the same row (same tone-based styling `RecordDetailScreen`/`RecordCard`'s `badgeSx` already establish — reuse `badgeSx` from `ui/src/components/RecordCard` the same way `TeamDetailPage.tsx` already imports it, rather than re-deriving the tone→style mapping inline).
  - The "Edit" button, same tinted-outlined treatment (`bgcolor: alpha(primary.main, 0.12)`, `color: primary.dark`) `RecordDetailScreen`'s header already uses — copy that styling verbatim so the button looks identical to today.
  - The old "Sections" heading/Chip-trail block is deleted entirely — fully superseded by the header chip row.

- **Body** — a `Box` with `sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}` (same shape as `TeamDetailPage`'s Contacts/Sponsors grid), holding four `Card`s (`ui/src/components/Card`, `variant="outlined"` per its own default) in this order:
  1. **Basic Info** — unchanged fields (Date of birth, Gender, Membership number, Jersey number), same `DetailFieldRow`/`DetailFieldGrid` primitives and icons as today.
  2. **Contact Info** — existing fields (Phone, Email, Alternative contact name, Alternative contact phone) **plus two new `DetailFieldRow`s**: "Medical aid provider" (`player.medicalAidProvider ?? '—'`) and "Medical aid number" (`player.medicalAidMemberNumber ?? '—'`). Pick a sensible existing MUI outlined icon for these two rows (e.g. `LocalHospitalOutlined` or `HealthAndSafetyOutlined` — whichever is verified to exist in the installed `@mui/icons-material` version at build time), reused for both rows.
  3. **Cricket Info** — unchanged fields (Batting stance, Bowling arm, Bowling type, Wicketkeeper).
  4. **Stats** (new) — a real placeholder: a small header row (title "Stats" + a muted "Coming soon" `Chip`, styled with the same muted tone `badgeSx('muted')` already produces), then a `DetailFieldGrid` of four fields (Matches, Runs, Wickets, Average) each showing a muted `—` in place of a value, then a muted "Full breakdown" caption + trailing chevron icon at the bottom (visual affordance only — no link, no click handler; this card does not navigate anywhere yet, per spec's Non-goals).

  Each card's heading (`Basic Info`, `Contact Info`, `Cricket Info`, `Stats`) keeps today's exact heading style — `Typography variant="subtitle2"` with `textTransform: 'uppercase'`, `letterSpacing: '0.04em'`, `color: 'text.secondary'` (copied from `RecordDetailScreen.tsx`'s current section-heading markup) — rendered as the `Card`'s first child rather than via `Card`'s own `title` prop (which renders a plain, non-uppercase `subtitle1`), so the visual style users already know for these three headings doesn't change, only the surrounding layout does. The Stats card's header additionally needs the trailing chip, so it's a small flex row (`Stack direction="row" justifyContent="space-between" alignItems="center"`) rather than a bare heading — a page-local pattern, not a new shared component, matching how `TeamDetailPage.tsx`'s own private `CardHeaderRow` helper is local to that one file.

- Delete the now-unused imports (`Chip`/`Stack`/`Typography` stay in use; drop `RecordDetailScreen`/`DetailFieldRow`/`DetailFieldGrid`'s import path — actually `DetailFieldRow`/`DetailFieldGrid` stay imported, only the `RecordDetailScreen` component import itself is dropped) and add `PageHeaderBand`, `Card`, `badgeSx`, `RouterLink`, `alpha`, `ArrowBackIcon`, `EditOutlinedIcon`, and a chevron icon for the Stats affordance.

### 2. Rewrite `ui/src/pages/manage/PlayerDetailPage.test.tsx` (test-writer)

The current file asserts on things that no longer exist (`screen.getByText('Sections')`, `'Not tagged to any sections yet.'`) and needs new coverage for the header chips, Medical Aid fields, and the Stats placeholder. Keep the existing `makePlayer`/`makeSection`/`renderPage` test scaffolding and the three existing scenarios (`not authorized`, `error state for unmatched id`), but update/add:

- The "loads and renders every section" test: assert the section's breadcrumb (`U15`) renders in the header (not under a "Sections" heading), assert `Basic Info`/`Contact Info`/`Cricket Info`/`Stats` all render, assert the two new Medical Aid fields render both when set and (a separate case, or an extended `makePlayer` override) fall back to `—` when null.
- A new assertion that the Stats card always renders its "Coming soon" chip and `—` placeholders — no fabricated numbers.
- Replace the "renders 'Not tagged to any sections yet'" test with an equivalent check that the header simply shows no section chip (and doesn't error) when `listPlayerSections` resolves empty — mirroring `TeamDetailPage.test.tsx`'s own pattern of asserting the *absence* of a chip rather than a body-text fallback, since the old body-level fallback message no longer has anywhere to render (a header with zero chips, not an empty-state sentence, is the exact acceptance criterion the spec states for a player with no tagged sections).
- Keep asserting `screen.queryByRole('textbox')` is absent and the Edit link's `href`.

No `.stories.tsx` file is needed or exists for this page — `pages/**` are exempt from the four-file component anatomy per `docs/standards/frontend.md`.

## Files touched

- `ui/src/pages/manage/PlayerDetailPage.tsx` — rewritten (frontend-builder)
- `ui/src/pages/manage/PlayerDetailPage.test.tsx` — rewritten (test-writer)

No other file changes. No backend changes, no new shared components, no route changes (`ui/src/App.tsx` already points `players/:playerId` at `PlayerDetailPage`, unchanged), no changes to `PlayerFormPage.tsx` or `PlayerList.tsx`.

## Verification

1. `cd ui && npm run lint` and `npm run build` — confirm no unused-import or type errors from the rewrite.
2. `npm run test -- PlayerDetailPage` — confirm the rewritten test file passes against the rewritten component.
3. Manual smoke test (per `CLAUDE.md`'s UI rule): run `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` and `cd ui && npm run dev`, log in as a club admin, open a player with tagged sections, medical aid details, and full cricket info from `/manage/players`, and visually confirm the page matches the approved Claude Design canvas — section chip(s) under the name, the four cards paired two-per-row on desktop, Medical Aid visible in Contact Info, and the Stats placeholder rendering with `—` values. Also check one player with no tagged sections and no medical aid to confirm the empty/fallback states look right (no error, no empty chip, `—` values).
4. Resize the browser to a phone width (or check Storybook-equivalent responsive behavior) to confirm the grid drops to one column and the header chip row wraps, per the spec's mobile-first requirement.
