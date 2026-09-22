# Plan: 046 — Header/Body Elevation Standard

## Context

`docs/specs/046-header-body-elevation-standard.md` (proposed) replaces `044`/`045`'s rolled-back saturated-gradient-banner direction with a tonal/elevation-based header + body treatment, approved by the user against a live mockup covering Matches (list/view/edit) and explicitly scoped to cover the *entire* header-bearing surface in one pass: `RecordDetailScreen` (8 call sites), `RecordFormScreen` (13 call sites, 9 `/manage` + 4 `/admin`), and `ManageScreenHeader` (11 call sites) — 32 screens total, zero page-level edits needed since all three are shared components. The user has explicitly asked to build this now, with two standing instructions: (1) match the approved mockup's literal values exactly, not an approximation, and (2) this is the one spec covering everything, not an iterative per-screen crawl.

Two new shared components carry the whole change: `PageHeaderBand` (white background, divider bottom border, theme-derived shadow, 3px `primary.main` top accent, full-bleed bleed) and `ContentCard` (reuses `RecordCard`'s existing `bgcolor: 'background.paper'` / `boxShadow: 2` convention). No contrast-clamp machinery this time — nothing renders on top of a color fill, so `044`'s `getContrastRatio`/`lighten`/`darken` logic is not reused.

Direct reading of every target file (this session) confirmed:
- `theme.ts`, `RecordCard.tsx` are back to their pre-044 state (044's rollback was verified complete by both this session and 046's own spec-authoring pass) — a clean base to build on, no leftover dead code to clean up first.
- `RecordFormScreen.tsx` (`ui/src/components/RecordFormScreen/RecordFormScreen.tsx`) has exactly two content regions today: a header `Box` (back-link + title, no avatar/badge/secondaryActions slots — the simplest of the three consuming components) and, separately, a field-grid `Box` + an actions-bar `Box` (divided by its own `borderTop`). `MatchFormPage.tsx` confirms directly (grep: lines 816/844-856/916-923/948) that a consuming page's `<Tabs>` renders *inside* `RecordFormScreen`'s `children` (the field-grid region), not as a separate slot — so wrapping `RecordFormScreen`'s children+actions-bar together in one `ContentCard` automatically wraps any consumer's tabs too, no per-page edit needed, exactly as the spec states.
- `ManageScreenHeader.tsx` has one content region (back-link + title-row-with-optional-`action`) — the whole component becomes `PageHeaderBand`'s children, no body-region change (its consuming screens' `ListToolbar`/`RecordCard` already have their own white/shadowed surface per `043`, confirmed unchanged).
- `RecordDetailScreen.tsx`'s current `sections.map(...)` stack separates entries with `index > 0 ? { pt: 3, borderTop: 1, borderColor: 'divider' } : undefined` — this whole conditional border-top is replaced by wrapping every entry in its own `ContentCard`, using the existing outer stack's `gap: 3` for spacing between cards instead.
- `PlayingXiSummary`'s "No XI selected yet" state (`ui/src/components/PlayingXiSummary/PlayingXiSummary.tsx:48`) uses the shared `EmptyState` component — confirmed nothing here needs touching; it just ends up nested inside whichever `ContentCard` its containing section (Home XI / Away XI) now gets, keeping its own distinct look.
- **A real edge case the spec doesn't examine at the call-site level, found during this session's own reading, not assumed**: `SponsorDetailPage.tsx` (`ui/src/pages/manage/SponsorDetailPage.tsx:69-78`) renders its one section's content as its own manually-bordered/tinted `Box` (`border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: alpha(primary.main, 0.05), p: 3`) — a bespoke "Sponsor decision" from `036`. Once `RecordDetailScreen` wraps every section in a `ContentCard` automatically (per spec, applied uniformly regardless of what a section's `content` renders), this box would double-nest inside the new white/shadowed `ContentCard`, producing a border-and-tint box inside a border-and-shadow box — a real, if minor, visual regression the spec's own UI Requirements don't call out. Flagged below rather than silently decided.

## Files to touch, in order

### 1. `ui/src/theme.ts` (edited) — one new helper

Add, alongside `pageBackgroundGradient()`:
```ts
export function headerBandShadow(theme: Theme): string {
  return `0 2px 6px ${alpha(theme.palette.text.primary, 0.06)}`
}
```
`alpha` is already imported. No other theme.ts change — none of `044`'s contrast-clamp helpers (`getContrastRatio`/`lighten`/`darken`) are reintroduced; this spec has no color-on-color text to protect.

### 2. `ui/src/components/PageHeaderBand/` (new, four-file anatomy: `.tsx`/`.test.tsx`/`.stories.tsx`/`index.ts`)

```tsx
export interface PageHeaderBandProps {
  children: ReactNode
}

export function PageHeaderBand({ children }: PageHeaderBandProps) {
  return (
    <Box
      sx={{
        mx: { xs: -2, md: -3 },
        mt: { xs: -2, md: -3 },
        mb: 0,
        px: { xs: 2, md: 3 },
        pt: { xs: 2, md: 3 },
        pb: 3,
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
        boxShadow: (theme) => headerBandShadow(theme),
        borderTop: (theme) => `3px solid ${theme.palette.primary.main}`,
        borderBottomLeftRadius: (theme) => theme.shape.borderRadius * 2,
        borderBottomRightRadius: (theme) => theme.shape.borderRadius * 2,
      }}
    >
      {children}
    </Box>
  )
}
```
No other props — the band's values are fixed by definition (spec's own explicit choice, mirroring `045`'s now-superseded `HeaderGradientBand` reasoning). The negative-margin bleed values are unchanged from `044`'s already-proven technique, coupled to `AppShell`'s/`GridNavShell`'s shared `<main>` `p: { xs: 2, md: 3 }` (confirmed by `046`'s own spec research — `RecordDetailScreen`/`RecordFormScreen`/`ManageScreenHeader` never render inside `BottomTabShell`, so no third-shell coupling to worry about). `borderTop` is the simplest correct way to render the 3px accent flush with the band's own top edge without a second element — used here rather than an absolutely-positioned inner `Box`, since it needs zero extra markup and cannot desync from the band's own border-box.

### 3. `ui/src/components/ContentCard/` (new, four-file anatomy)

```tsx
export interface ContentCardProps {
  children: ReactNode
  sx?: SxProps<Theme>
}

export function ContentCard({ children, sx }: ContentCardProps) {
  return (
    <Box sx={{ bgcolor: 'background.paper', boxShadow: 2, borderRadius: 1, p: 3, ...sx }}>
      {children}
    </Box>
  )
}
```
`boxShadow: 2` and `bgcolor: 'background.paper'` are copied verbatim from `RecordCard.tsx`'s own `MuiCard` sx (`ui/src/components/RecordCard/RecordCard.tsx:148`, confirmed identical values), not a new shadow recipe. `borderRadius: 1` matches `theme.shape.borderRadius` (MUI's `borderRadius: 1` = `theme.shape.borderRadius × 1` = 8px, the same radius `RecordCard`'s own `MuiCard` gets by default). `p: 3` (24px) matches the existing spacing already used at every call site this wraps (`RecordFormScreen`'s own `gap: 3` field grid, `RecordDetailScreen`'s own `pt: 3` section spacing) — chosen so nothing needs its own internal padding re-tuned. The optional `sx` passthrough exists for the one genuine per-caller need identified below (Sponsor's now-redundant inner styling).

### 4. `ui/src/components/RecordDetailScreen/RecordDetailScreen.tsx` (edited)

- Import `PageHeaderBand` from `../PageHeaderBand`, `ContentCard` from `../ContentCard`.
- Replace the current outer header `<Box>` (back-link `Button` + avatar/title/badge/secondaryActions/Edit `Stack`) with `<PageHeaderBand>` wrapping that exact same inner content, unchanged (avatar tint, badge tones, button treatments — none of it changes per spec).
- Title `Typography` (`variant="h6" component="h1"`): add `fontWeight: 700` (the one named type-scale exception).
- Replace the `sections.map(...)` block's `index > 0 ? { pt: 3, borderTop: 1, borderColor: 'divider' } : undefined` conditional with: every section wrapped in its own `<ContentCard>` (heading + `note` + `content` all render inside it, exactly as today), letting the outer stack's existing `gap: 3` provide inter-card spacing instead of the border-top.

### 5. `ui/src/pages/manage/SponsorDetailPage.tsx` (edited — small, in-scope cleanup, not new scope)

Remove the section content's own manual `border`/`borderColor`/`bgcolor` (`alpha(primary.main, 0.05)`) now that `ContentCard` already provides the "this is a distinct surface" job that `Box` was doing by hand — keep only its `p`/`pb` sizing (or drop entirely and let `ContentCard`'s own default `p: 3` cover it, adjusting only if the social-links `pb: 7` spacing is still needed via `ContentCard`'s `sx` passthrough). Leaves the `EmptyState` branch (`!hasAnyContactField && !hasSocialLinks`) untouched. This is the one call-site edit in this plan — everything else is inherited automatically — because leaving it as-is would double-box (a tinted/bordered `Box` nested inside a white/shadowed `ContentCard`), a real visual regression `046`'s own UI Requirements didn't examine at this call-site level (flagged in Context above, resolved here rather than left for a reviewer to trip over later).

### 6. `ui/src/components/RecordFormScreen/RecordFormScreen.tsx` (edited)

- Import `PageHeaderBand`, `ContentCard`.
- Replace the header `<Box>` (back-link + title) with `<PageHeaderBand>` wrapping the same content.
- Title `Typography`: add `fontWeight: 700`.
- Replace the two separate `<Box>`es (field grid `children`, and the actions bar below its own `borderTop`) with one `<ContentCard>` wrapping both — the grid and the actions bar, with the actions bar's existing `borderTop: 1, borderColor: 'divider'` kept as an *internal* divider inside the card (unchanged value, now reads as an inner separator rather than a page-level one).

### 7. `ui/src/components/ManageScreenHeader/ManageScreenHeader.tsx` (edited)

- Import `PageHeaderBand`.
- Replace the outer `<Box>` (back-link + title-row-with-`action`) with `<PageHeaderBand>` wrapping the same content, unchanged internally.
- Title `Typography`: add `fontWeight: 700` (on top of its existing `fontWeight={600}` — becomes `700`, replacing not adding to it).
- No body-region change — this component has none of its own.

### 8. Storybook — new + extended stories

- `PageHeaderBand.stories.tsx` (new): a default-theme story and a `withClubBranding()`-overridden story (nested `ThemeProvider`, same pattern `044` established for `RecordDetailScreen.stories.tsx`'s `LightClubBranding` story) — makes the top accent bar's re-tinting visible, the one club-color-dependent element left.
- `ContentCard.stories.tsx` (new): a simple default story with representative children.
- `RecordDetailScreen.stories.tsx`, `RecordFormScreen.stories.tsx`, `ManageScreenHeader.stories.tsx`: existing stories' args are unchanged (no prop shape changed anywhere) — they just render the new look automatically. No new stories strictly required here since the component-level `PageHeaderBand`/`ContentCard` stories already cover the isolated treatment, but confirm each existing story still renders sensibly (especially `RecordDetailScreen.stories.tsx`'s `SingleCustomCardSection` story, which mirrors `SponsorDetailPage`'s pattern — update its own inline `Box` styling the same way item 5 does, so the story doesn't demonstrate the double-boxing this plan just resolved in real code).

## Agent assignment

Frontend-only (spec's Data Model Changes / API Contract are both "None" — no backend-builder work).

1. **`frontend-builder`** — items 1–8 (theme helper, both new shared components + their stories, the three consuming components' restyle, `SponsorDetailPage.tsx`'s cleanup, and the `SingleCustomCardSection` story fix). One dispatch is enough; brief it explicitly on:
   - Every color/shadow/spacing value in items 1–3 is a literal, checkable requirement per the spec's own "Design fidelity" section — not to be approximated or re-interpreted (this is the specific, named feedback that prompted this instruction: past builds have drifted from approved designs).
   - The `SponsorDetailPage.tsx` edit (item 5) and the matching Storybook story fix are in scope for *this* dispatch, not a follow-up — they exist specifically to avoid shipping a double-boxed regression the moment `RecordDetailScreen` changes.
   - `ManageScreenHeader`'s title change is a *replacement* of its existing `fontWeight={600}`, not an addition on top of it.
2. **`test-writer`** (after `frontend-builder`) — fills the Test Plan's tiers against what's actually on disk: `PageHeaderBand.test.tsx`, `ContentCard.test.tsx` (both new — render `children`, computed surface values match the literal requirements above; `PageHeaderBand`'s under both `baseTheme` and a `withClubBranding()` theme, asserting white/border/shadow are identical across both and only the top accent color differs). `RecordDetailScreen.test.tsx`/`RecordFormScreen.test.tsx`/`ManageScreenHeader.test.tsx` extended per the spec's own Test Plan table (existing assertions unaffected; new assertions that each renders inside `PageHeaderBand`/sections or body render inside `ContentCard`/title `fontWeight` is `700`). No contrast-ratio test machinery needed anywhere (spec's own explicit simplification vs. `044` — nothing renders on top of a color fill here).

## Flags for your review

- **`SponsorDetailPage.tsx`'s double-boxing (Context + item 5)** — a real call-site edge case the spec's UI Requirements don't examine (it's written at the `RecordDetailScreen` component level, correctly, but this is the one existing page whose section content already brings its own "distinct surface" styling that now collides with the new automatic one). Resolved in this plan as a small, obviously-necessary cleanup rather than left to be discovered mid-build or shipped as a visible regression — flagging since it's the one place this plan makes a call the spec itself didn't make.
- **Design-fidelity check (spec's own Test Plan requirement)**: the spec requires a manual side-by-side comparison against the approved mockup before this is called done, not just passing unit tests. I don't have a working browser-automation tool in this environment (confirmed earlier this session — no `chromium-cli`, no Playwright driver configured) to perform that check myself. Recommend you do a live visual pass once `frontend-builder` finishes (dev server is already running on `localhost:5173`) on at least Matches list/view/edit — the exact three screens the mockup was approved against — before treating this as shippable.

## Verification

- `cd ui && npm run build && npm run lint && npm run test && npm run test:storybook`.
- Manual smoke test on Matches list (`ManageScreenHeader`), Match view (`RecordDetailScreen`), and Match edit (`RecordFormScreen`) at 375px and desktop widths — the three screens the design was approved against — confirming: header is full-bleed white with the 3px top accent, bottom border/shadow separate it from content, title reads bolder; every section/body card renders as a distinct white/shadowed surface against the existing page wash; the "No XI selected yet" empty state still reads as visually distinct, nested inside its own card; Sponsor's detail page no longer double-boxes.
- The design-fidelity comparison against the approved mockup (flagged above) — this is the real acceptance gate per the spec's own Test Plan, not optional polish.
