# 044 — Record Detail Screen Gradient Header

**Depends on:** `036-view-first-record-detail-screens.md` (built `RecordDetailScreen` itself — the shared, read-only header/section shape this spec restyles without touching its props or the eight `*DetailPage.tsx` call sites: Player, Team, Match, League, Season, Club Contact, Sponsor, Sponsor Contact), `043-list-toolbar-gold-standard.md` (the most recent precedent for this exact shape of change — one shared component's chrome changes once, every screen composing it inherits the change automatically, no page-level edits), `001-tenancy-identity-model.md`'s White-Labelling section (`ClubBranding`, `withClubBranding()` — the reason this header must be theme-derived, not a fixed colour, and — per this spec's own research below — the reason it needs its own contrast safeguard rather than trusting an already-enforced backend guarantee), `docs/standards/design-system.md` (Two Token Layers, Token table — the literal palette values this spec derives from rather than hardcodes).
**Status:** superseded by `046` — the saturated gradient-band direction this spec built was reviewed live against the real app, found visually inconsistent with every other screen, and rolled back entirely (code reverted, nothing shipped). `046` replaces it with a tonal/elevation-based header + body treatment across every header-bearing screen at once. Kept here as a record of the approach tried and why it didn't work — the contrast-safety research (`contrastSafeBase`/`contrastSafeLightenedStop`, the found `withClubBranding()` `primary.dark` bug) remains genuinely useful reference even though the visual direction was abandoned.

## Problem & Goals

`RecordDetailScreen` (`ui/src/components/RecordDetailScreen/RecordDetailScreen.tsx`) is the shared read-only header every entity detail screen renders — a "Back to X" link, then a row of avatar/title/badge on the left and secondaryActions/Edit on the right — sitting directly on the page's existing subtle wash (`pageBackgroundGradient()` in `ui/src/theme.ts`, applied to every shell's `<main>`). Visualized options for making that header read as a distinct zone from the page body were explored directly against this product, and a "brand gradient banner" direction was picked: the header zone becomes a full-bleed, diagonally-gradiented band in the club's brand colour, with all its text/icons flipped to a light treatment, while everything below it (the Details grid, entity-specific sections) keeps today's light page wash unchanged.

This is a single-component, presentational-only change — `RecordDetailScreen` is composed identically by all eight `*DetailPage.tsx` screens (`036`'s own call-site table), so every one of them inherits the new header automatically once this spec ships, with zero page-level edits.

**Goals**
- `RecordDetailScreen`'s header zone (back-link row + avatar/title/badge row + secondaryActions/Edit row) renders as one full-bleed, brand-gradient band, visually distinct from the page body below it.
- Every colour used inside that band — gradient stops, shadow, avatar fill, badge tones, button treatments — is computed from `theme.palette.primary.main`/`.dark` (and MUI's structural `common.white`) at render time, the same "derive from the theme, never hardcode" discipline `pageBackgroundGradient()` already established, so a club's own `withClubBranding()` primary colour re-tints the header automatically.
- The gradient construction is contrast-safe by design, not just by luck on the platform's own default green — see the Accessibility finding below, a real, measured problem with the original literal mockup values, not a hypothetical one.
- `RecordCardBadge`'s three tones (`positive`/`neutral`/`muted`) get a second, dark-banner-appropriate treatment, since their existing light-surface styling (`RecordCard.tsx`'s `badgeSx`) assumes a light background.

**Accessibility finding (why this isn't just a styling pass)**

The visualized option's literal gradient recipe — `linear-gradient(135deg, #2f6e4f 0%, #3a7d5c 55%, #56977a 100%)`, white text throughout — was checked directly against WCAG 2.1's contrast formula before writing this spec, using the platform's own **default** theme (`ui/src/theme.ts`), not a hypothetical light club colour:

| Stop | Hex | Measured contrast vs. white text |
|---|---|---|
| 0% | `#2f6e4f` (`primary.main`) | ≈ 6.1:1 — passes AA (≥4.5:1) |
| 100% | `#234f39` (`primary.dark`) | ≈ 9.3:1 — passes AA |
| 55% | `#56977a` (the mockup's own "lightened toward the far corner" stop) | ≈ 3.4:1 — **fails** AA body-text contrast (4.5:1); only clears WCAG's separate large-text allowance (3:1), which doesn't apply to this header's `body2`/`caption`-sized back-link, badge, and button text |

Shipping the mockup's literal third stop would ship a known-failing contrast on this codebase's own default brand colour — not an edge case reachable only by an unusually light future club colour. That risk gets categorically worse once a club's own `primary.main` is itself light (a plausible real scenario: `ClubBranding.primaryColor` is a closed, admin-editable field per `001`, and nothing in this codebase validates it today — see below). This spec's UI Requirements build the gradient to be safe against both cases by construction, not just the default.

**Also discovered during this research, worth surfacing explicitly:** `docs/standards/design-system.md`'s Two Token Layers section already states "a brand colour that fails contrast against the base neutrals is rejected at save time, not shipped" — but no such validation exists anywhere in this codebase yet. `ClubProfile` (`backend/src/main/java/com/cricketlegend/domain/ClubProfile.java`) has no `primaryColor` field at all; `ui/src/branding/fetchBranding.ts`'s own comment confirms `/public/branding` doesn't exist yet and `withClubBranding()` is called from no production code path. That sentence in `design-system.md` describes an intended contract, not a shipped one. This spec's frontend clamp (below) is therefore the *only* real guard that will exist once this ships — not a redundant second layer over an already-enforced backend rule. Flagged for `docs/roadmap.md` (see Rollout Notes).

## Non-goals

- **No change to `RecordDetailScreen`'s props, or to any of the eight `*DetailPage.tsx` call sites.** `avatar`, `badge`, `secondaryActions`, `editTo`/`editLabel`, `sections` all keep their exact current shape and call-site values — this is an `sx`/styling-only change to the header band's chrome, not a data or API change.
- **No change to section content below the header.** The Details grid, nested `RecordCard` grids (Team's Contacts/Sponsors/Squad, League's Affiliations), and every other section stay on the existing light `pageBackgroundGradient()` wash exactly as `036` built them — only the header zone above the first section divider changes.
- **No backend change, no `ClubBranding`/`primaryColor` persistence work.** `ClubProfile` still has no `primaryColor` field, no `/public/branding` endpoint is added, and `withClubBranding()` is still called from no production code path — all of that stays exactly as blocked as it is today (`001`, `003-club-onboarding.md`).
- **No real, enforced backend save-time contrast validation for `ClubBranding.primaryColor`.** Confirmed above as a genuinely unbuilt gap, but building it is backend work, out of scope for a UI-only spec — flagged for `docs/roadmap.md` instead (Rollout Notes), not built here. This spec's own frontend clamp exists specifically *because* that backend guarantee doesn't exist yet, not as a stand-in that removes the eventual need for it.
- **No change to `RecordCard`'s own existing light-surface `badgeSx` treatment.** A second, additive dark-banner variant is introduced for `RecordDetailScreen`'s own use (see UI Requirements); `RecordCard`'s ordinary card-grid badge rendering is untouched.
- **No change to `ManageScreenHeader`, `RecordFormScreen`, `RecordCard`'s own header row, or any other shared header-shaped component**, even though some share visual DNA with this one. Scoped to `RecordDetailScreen.tsx` (plus the new theme.ts helpers and the `badgeSx` addition it needs) only.
- **No new, generalized accessibility tooling** (e.g. a Storybook `axe`/a11y addon rolled out platform-wide). The contrast check this spec needs is a targeted, one-component test assertion (Test Plan) using MUI's own already-available contrast utility — not a new investment in automated a11y scanning infrastructure.
- **No permission-gated Edit visibility.** Still `036`'s own named, deliberately-deferred item — untouched here.

## User Stories

- As a club admin viewing any entity's detail screen (Player, Team, Match, League, Season, Club Contact, Sponsor, or Sponsor Contact), I see a clearly distinct, brand-coloured header band separating the record's identity and actions from the page content below, instead of today's single, subtle page-wide wash.
- As a club admin at a club with its own brand colour, that header band renders in *that* colour, automatically, the same way the rest of the app already re-tints via `withClubBranding()`.
- As a club admin at a club whose brand colour happens to be light, the header band's text and buttons stay legible — the header doesn't silently become unreadable just because that club's `primaryColor` isn't as dark as the platform default.
- As a developer maintaining `RecordDetailScreen`, every colour used inside the header band traces back to a theme token (`theme.palette.primary.*` / `common.white`) computed at render time — no literal brand hex string lives in the component file.
- As an accessibility reviewer, every text/icon element rendered inside the header band meets WCAG AA's 4.5:1 body-text contrast against the gradient stop directly behind it, verified by an automated check, not eyeballed.

## Data Model Changes

None. Purely a frontend, presentational-layer change to one existing shared component. No entity, field, migration, or endpoint is added or touched.

## API Contract

None. No endpoint is added, removed, or changed.

## UI Requirements

**Blast radius, stated explicitly:** this spec changes exactly one file's rendering (`ui/src/components/RecordDetailScreen/RecordDetailScreen.tsx`), plus small, additive changes to `ui/src/theme.ts` (new gradient/shadow helpers) and `ui/src/components/RecordCard/RecordCard.tsx`'s exported `badgeSx` (a new dark-banner variant, additive). Every one of the eight `*DetailPage.tsx` screens (`036`'s table: Player, Team, Match, League, Season, Club Contact, Sponsor, Sponsor Contact) picks up the new header automatically — none of them is edited by this spec.

**Applies uniformly regardless of per-entity slot contents, stated explicitly:** the gradient band is header *chrome*, independent of whether `avatar` is present/`rounded`/`circular`, whether `badge` is present, or whether `secondaryActions` has zero or more entries (`037-match-improvements.md`'s addition). A screen with none of those (e.g. Season, Club Contact, Sponsor, Sponsor Contact — title + Edit only, per `036`'s table) gets the identical band treatment as Match (avatar + badge + a secondary action + Edit); only the slot contents inside the band differ, never the band's own structure, colour derivation, or shadow.

**1. New theme.ts helpers, alongside `pageBackgroundGradient()`** (same file, same "derive from `theme.palette`, never hardcode" precedent — not inlined into `RecordDetailScreen.tsx`):
- `detailHeaderGradient(theme: Theme): string` — builds the `linear-gradient(135deg, ...)` CSS string from `theme.palette.primary.main` (0%) and `theme.palette.primary.dark` (100%), with a middle stop (~55%) that is `primary.main` lightened toward white — but **only as far as MUI's own `getContrastRatio` (exported from `@mui/material/styles`, the same function `createPalette` uses internally for `getContrastText`) confirms the resulting colour still measures ≥4.5:1 against solid white**, capped at a modest maximum lighten fraction so an already-very-dark `primary.main` doesn't produce a stop that reads as washed-out. If `getContrastRatio('#fff', theme.palette.primary.main)` is already below 4.5 on its own (a club branding colour lighter than roughly a mid-tone green), the middle stop clamps to `primary.main` itself — i.e. no lightening at all, the whole band stays a flat two-tone dark gradient — rather than shipping a stop that fails. This is a deliberate correction of the original mockup's literal `#56977a`, not an approximation of it — see the Accessibility finding above for the measured reason.
- `detailHeaderShadow(theme: Theme): string` — the downward separation shadow (mockup's `0 8px 16px -10px rgba(20,64,45,0.45)`), built as `` `0 8px 16px -10px ${alpha(theme.palette.primary.dark, 0.45)}` `` — `primary.dark` (`#234f39`) is already close to the mockup's literal shadow colour, so this reuses the existing dark token via `alpha()` (already imported in `theme.ts`) instead of a second hardcoded hex.
- Exact function names/signatures above are illustrative for the plan/build stage, not binding syntax — the binding requirement is: **both values are computed from `theme.palette` at render time, both live in `theme.ts` next to `pageBackgroundGradient()`, and the gradient's lightened stop is clamped by a real, checked contrast computation, not a fixed percentage.**

**2. `RecordDetailScreen.tsx`'s header zone becomes one full-bleed band.** Today the Back-link `Box` and the avatar/title/badge + secondaryActions/Edit `Stack` sit directly on the page body's existing padding and wash (inherited from whichever shell's `<main>` renders it — `AppShell`, `GridNavShell`, and `BottomTabShell` all currently apply the identical `p: { xs: 2, md: 3 }` to their `<main>`, confirmed directly in each). "Full-bleed" is defined explicitly as: the band spans edge-to-edge within `<main>`'s content area and sits flush against `<main>`'s own top edge — achieved via negative margins that cancel that shared `p: { xs: 2, md: 3 }` (`mx`/`mt` of `{ xs: -2, md: -3 }`) plus matching internal padding (`px`/`pt` of `{ xs: 2, md: 3 }`) on the band itself, with a bottom margin of `0` (the page content immediately below stays exactly where it is). The band's top corners stay square (flush with `<main>`'s own edge); its bottom corners round softly (derived from `theme.shape.borderRadius`, e.g. `2×` it) so it reads as a banner transitioning into the page body, not a hard-edged strip.
   - **Known coupling, flagged rather than hidden:** this ties the band's negative-margin values to the literal `p: { xs: 2, md: 3 }` all three shells currently share. If a future shell ever uses a different `<main>` padding, this band's bleed would misalign. Accepted as a reasonable, currently-safe coupling (three shells already agree on this value) rather than solved with new plumbing (e.g. a shared padding token threaded through context) — flag for whoever next touches shell padding to notice this dependency, not a blocker for this spec.

**3. Colour treatment inside the band** (every value below derived from `theme.palette`, never a literal hex in the component, per the Accessibility finding):
   - Background: `detailHeaderGradient(theme)`; shadow: `detailHeaderShadow(theme)`.
   - Back-link text/icon: `alpha(theme.palette.common.white, 0.85)` (replacing today's `text.secondary`).
   - Avatar: background `alpha(theme.palette.common.white, 0.18)`, fallback/icon colour `theme.palette.common.white` (replacing today's `alpha(primary.main, 0.14)` / `primary.dark`).
   - Title: `theme.palette.common.white` (replacing the default `text.primary` inherited today).
   - `secondaryActions` buttons: outlined, `border: 1px solid ${alpha(theme.palette.common.white, 0.55)}`, text/icon `theme.palette.common.white` (replacing today's `color="inherit"` outlined treatment).
   - Edit button: filled, `bgcolor: theme.palette.common.white`, `color: theme.palette.primary.dark`, border transparent (replacing today's `alpha(primary.main, 0.12)` tinted-outlined treatment) — stays the one visually "loudest" element in the band, consistent with it being the screen's one mutating affordance.

**4. Badge (`RecordCardBadge`) treatment on the gradient — a new, additive dark-banner variant of `RecordCard.tsx`'s existing `badgeSx(tone)` export**, since that function's current three tones (`positive`/`neutral`/`muted`) all assume a light background and would be invisible or muddy on the gradient:

| Tone | Existing light-surface treatment (unchanged) | New dark-banner treatment |
|---|---|---|
| `positive` | `alpha(primary.main, 0.12)` fill, `primary.dark` text, bold | Solid `common.white` fill, `primary.dark` text, bold — inverted, mirrors the Edit button's own "loudest element, filled white" treatment |
| `neutral` | Outlined, default border/text colour | Outlined, `border: alpha(common.white, 0.55)`, text `common.white` — matches `secondaryActions`' own outlined-white treatment |
| `muted` | `alpha(text.secondary, 0.12)` fill, `text.secondary` text, `opacity: 0.7` | Outlined, `border: alpha(common.white, 0.3)`, text `alpha(common.white, 0.65)`, `opacity: 0.75` — stays the visibly lowest-emphasis tone of the three, same relative ordering as today |

Implemented as `badgeSx(tone, { onDarkBanner: true })` (or an equivalent additive second parameter/overload) rather than a second, parallel export — reuse of the existing tone-to-meaning mapping, not a fork of it, per `docs/standards/frontend.md`'s reuse-before-you-write rule. `RecordDetailScreen.tsx` is the only caller passing `onDarkBanner: true`; every existing `RecordCard` call site is unaffected.

**5. Section content below the header is explicitly unaffected** — the `sections` stack keeps its existing rendering (heading, `note`, `content`) on the page's existing `pageBackgroundGradient()` wash. No gradient, shadow, or white-text treatment leaks past the header band's own bottom edge.

Mobile-first: verified at 375/768/1280 (this component's existing Storybook viewport convention) — the band's negative-margin bleed uses the same `{ xs, md }` breakpoint shape already in use throughout this file, no new breakpoint logic invented.

## Test Plan

| Tier | Coverage |
|---|---|
| Component | `RecordDetailScreen.test.tsx` (extended): existing assertions (Back link href, title, sections in order, Edit href, secondaryActions ordering) are unaffected by this purely visual change — no interaction/behavior changed, only computed styles. New assertions: (a) the header band's computed background is derived from the active theme's `primary.main`/`.dark`, not a fixed value — rendered once under the default theme and once under a theme built via `withClubBranding('#e8d96a')` (a deliberately light, low-luminance-contrast synthetic colour chosen to prove the clamp engages), asserting the two renders differ; (b) a contrast assertion, using MUI's `getContrastRatio`, that every colour this spec introduces (title white, back-link `alpha(white, 0.85)`, badge foreground per tone, secondaryActions text, Edit button text) measures ≥4.5:1 against the darkest gradient stop actually rendered behind it, under both the default theme and the synthetic light-primary theme from (a) — the second case is the one that actually proves the clamp works, not just documents intent. `RecordCard.test.tsx` (extended): `badgeSx(tone, { onDarkBanner: true })` produces the three dark-banner treatments in the table above without altering the existing light-surface call (no second parameter passed) at all. |
| Contract | None — no endpoint touched. |
| End-to-end | None new. `036`'s own existing Playwright golden path (not wired into CI, per that spec's stated precedent) reaches every detail screen this spec restyles; spot-checked for gross breakage (band renders, Edit still navigates), not re-authored — this is a visual chrome change, not a new interaction. |

## Acceptance Criteria

- All eight entity detail screens (Player, Team, Match, League, Season, Club Contact, Sponsor, Sponsor Contact) render `RecordDetailScreen`'s new gradient-band header automatically, with zero edits to any `*DetailPage.tsx` file.
- No literal brand hex string (e.g. `#2f6e4f`, `#56977a`) appears anywhere in `RecordDetailScreen.tsx` — every band colour traces to `theme.palette.primary.*` or `theme.palette.common.white`, computed at render time.
- Rendering `RecordDetailScreen` under `withClubBranding(<any colour>)` — including a synthetically light one — re-tints the header band automatically and never produces a gradient stop that fails 4.5:1 contrast against the white text/icons rendered on top of it, per the component-test contrast assertion.
- The header band's structure (full-bleed bounds, shadow, colour derivation) is identical whether `avatar`, `badge`, or `secondaryActions` are present or omitted — only those specific slots' own content differs.
- Section content below the header (`sections`, `DetailFieldGrid`/`DetailFieldRow`, nested `RecordCard` grids) is visually unchanged — still rendered on the existing `pageBackgroundGradient()` wash, no dark/gradient treatment leaking downward.
- `badgeSx`'s existing light-surface behavior (every `RecordCard` call site) is unaffected; only the new, additive `onDarkBanner` path changes anything.
- No backend file, endpoint, entity, or migration is touched.

## Rollout Notes

- Ships as a single PR: `ui/src/components/RecordDetailScreen/RecordDetailScreen.tsx`, `ui/src/theme.ts` (new gradient/shadow helpers), `ui/src/components/RecordCard/RecordCard.tsx` (`badgeSx` dark-banner variant), plus `RecordDetailScreen.stories.tsx` and `RecordDetailScreen.test.tsx` updates — no page-level file (`*DetailPage.tsx`) needs touching, matching `043`'s own "one shared component, every screen inherits it" shape.
- **Flagged for a Claude Design pass before build**, mirroring `036`'s own precedent for `RecordDetailScreen`'s original section layout — even though the *direction* here (brand gradient banner) is already chosen from the user's own visualized options, the pass should confirm the exact clamp percentage, shadow/radius values, and the dark-banner badge treatments read well together, not just individually pass contrast.
- `RecordDetailScreen.stories.tsx` gains at least one story rendered under a `withClubBranding()`-overridden theme (a light synthetic colour) alongside the existing default-theme stories, so the clamp's effect is visible in Storybook, not just asserted in a test.
- **A human should update `docs/roadmap.md`** to add the backend save-time contrast-validation gap this spec's research surfaced (`design-system.md` already documents the rule; nothing enforces it yet) as a real, currently-untracked item — likely belonging to whoever eventually builds real `ClubBranding` persistence (`001`, `003-club-onboarding.md`).
