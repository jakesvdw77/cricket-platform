# Design System

Screens are composed from a library, not invented per page — the mechanical fix for "screens aren't mobile-friendly and UX isn't consistent." Built on **Material UI (MUI) v5** — the same library the original Cricket Legend app used (`ui/src/theme.ts`, `createTheme`) — not a hand-rolled utility-CSS system. See `docs/standards/frontend.md` for component anatomy and `docs/specs/001-tenancy-identity-model.md`'s White-Labelling section for how per-club branding layers on top of this.

## Workflow

1. **Tokens** — colour, type scale, spacing unit, and breakpoints, defined once in `ui/src/theme.ts` via MUI's `createTheme()`. This is the single source both Claude Design and the app read from.
2. **Component library** — Button, Input, Card, Nav, EmptyState first; Table, Modal, and loading states next — thin wrappers around `@mui/material` primitives with our variants locked in, built once against the theme, before any real screen.
3. **Storybook** — every component gets a story with the viewport addon at 375/768/1280. Mobile-friendliness is visible per-component, not discovered on a phone after ship.
4. **Screens** — composed only from the library. A screen needing a new visual pattern spins that off as a library addition first, spec'd on its own.
5. **Record** — tokens + component specs checked into this file; the `design-token-sync` skill keeps it and the code in lockstep.

*(Tokens and the first five components are done — see below and `ui/src/components/`. Table, Modal, and loading states are next.)*

## Two token layers

Per-club white-labelling means the token system has two layers, not one:

| Layer | Set at | Varies per club? | Examples |
|---|---|---|---|
| Structural tokens | Build time, `ui/src/theme.ts` | Never | Type scale, spacing unit, breakpoints, semantic colours, shape |
| Brand tokens | Runtime, per request | Always | Logo, favicon, display name, primary colour — the closed `ClubBranding` field set |

**Brand tokens stay a closed set.** The alternative — a club admin pasting in custom CSS — trades away everything this system is for: consistent components, accessible contrast, one shape per concern. A brand colour that fails contrast against the base neutrals is rejected at save time, not shipped.

**Runtime override mechanism:** `ui/src/theme.ts` exports `withClubBranding(primaryColor)`, which calls `createTheme(baseTheme, { palette: { primary: { main: primaryColor } } })` — MUI deep-merges this over the base theme, so every component styled through `theme.palette.primary` (which is all of them, via MUI's own theming) picks up the club's colour automatically. No CSS variable injection needed; this is MUI's own supported composition pattern.

## Token table

Source of truth: `ui/src/theme.ts`. Browsable in Claude Design (see below) and this table — the `design-token-sync` skill keeps all three in agreement.

### Colour (`theme.palette`)

| Token | Value | Use |
|---|---|---|
| `text.primary` | `#14231C` | Primary text |
| `text.secondary` | `#52655C` | Secondary text, captions |
| `background.default` / `background.paper` | `#FFFFFF` | Page / card background |
| `divider` | `#DEE6E1` | Hairlines, card borders |
| `primary.main` | `#2F6E4F` | Platform default brand colour — **the one token `ClubBranding` overrides at runtime** via `withClubBranding()`, everything else here never varies per club |
| `primary.dark` | `#234F39` | Primary hover/active state (MUI derives this automatically unless overridden) |
| `success.main` | `#0E7C66` | Confirmations, positive results |
| `warning.main` | `#B7791F` | Non-blocking warnings |
| `error.main` | `#B0402E` | Destructive actions, validation errors |
| `info.main` | `#2563AC` | Neutral informational states |

Semantic colours are deliberately a different hue family from `primary` so brand and state never read as the same signal.

### Type (`theme.typography`)

Single UI-optimised system font stack for both headings and body — no separate display face. This is a dense, stats-heavy product (scorecards, tables of overs/runs/wickets) read mostly on a phone; legibility at small sizes wins over a distinctive display face.

`fontFamily`: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`

MUI's default type scale (`h1`–`h6`, `body1`/`body2`, `caption`) is used unmodified rather than redefined — a deliberate decision not to fight the library's own well-tested scale. Tabular figures (scores, averages) use `font-variant-numeric: tabular-nums` via `sx`, e.g. the mono score display pattern in `UpcomingMatches`.

### Spacing & breakpoints

MUI's default spacing function (`theme.spacing(n)` = `n × 8px`) and default breakpoints (`xs` 0 / `sm` 600 / `md` 900 / `lg` 1200 / `xl` 1536) are used unmodified — matching the original Cricket Legend app's theme and avoiding a fight with the library's own scale. 375px remains the mobile-first *design baseline* — author unprefixed / `xs` styles at this width first per `docs/standards/frontend.md` — even though it isn't one of MUI's named breakpoints itself.

### Shape

`theme.shape.borderRadius: 8` — a single radius value applied across components by default (MUI multiplies it per-component as needed, e.g. `Chip` renders fully rounded). No separate custom radius tokens.

### Elevation

MUI's built-in `theme.shadows` (25-step array, used via the `elevation` prop) rather than custom shadow tokens. Our `Card` wrapper defaults to `variant="outlined"` (bordered, flat) rather than elevated — a deliberate flat, data-dense aesthetic; reach for `elevation` explicitly only where something genuinely floats above the page (menus, dialogs).

### Claude Design

Pushed to the "Cricket Legend Platform" design-system project for visual browsing, two groups:
- **Foundations** — Colour, Type, Spacing & Shape (values only; kept in sync via the `design-token-sync` skill whenever tokens change).
- **Components** — Button, Input, Card, Nav, EmptyState — static previews matching what's actually built in `ui/src/components/`, not just described. Push a matching preview for every new shared component alongside its `.stories.tsx` (`new-ui-component` skill), so this pane never drifts ahead of or behind the real library.
