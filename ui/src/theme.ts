import { alpha, createTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'

// Structural design tokens — docs/standards/design-system.md. Same values as
// the old cricketlegend app's ui/src/theme.ts pattern (createTheme, MUI v5),
// carried forward for this project rather than reinvented.
export const baseTheme: Theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#2f6e4f', dark: '#234f39', contrastText: '#ffffff' },
    success: { main: '#0e7c66' },
    warning: { main: '#b7791f' },
    error: { main: '#b0402e' },
    info: { main: '#2563ac' },
    background: { default: '#ffffff', paper: '#ffffff' },
    text: { primary: '#14231c', secondary: '#52655c' },
    divider: '#dee6e1',
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
  },
})

// The one runtime override — see docs/specs/001-tenancy-identity-model.md's
// White-Labelling section. MUI's createTheme(base, overrides) deep-merges,
// so every component styled via theme.palette.primary picks this up for free.
export function withClubBranding(primaryColor: string): Theme {
  return createTheme(baseTheme, {
    palette: { primary: { main: primaryColor } },
  })
}

// The page-body wash every post-login shell (AppShell, GridNavShell, BottomTabShell) applies to
// its <main> only — never the header/footer, which stay solid so brand chrome doesn't compete
// with it. A CSS gradient rather than a static image: derived from theme.palette.primary, so it
// re-tints automatically per club via withClubBranding() instead of showing the same fixed image
// regardless of which club is viewing it. Replaces flat white as every shell's body background.
export function pageBackgroundGradient(theme: Theme): string {
  return `linear-gradient(160deg, ${alpha(theme.palette.primary.main, 0.14)} 0%, ${alpha(theme.palette.primary.main, 0.03)} 45%, ${theme.palette.background.default} 75%)`
}

// The soft downward separation shadow under PageHeaderBand — docs/specs/046-header-body-
// elevation-standard.md. Theme-derived equivalent of the approved mockup's literal
// `0 2px 6px rgba(20, 35, 28, 0.06)`: theme.palette.text.primary is #14231c, so alpha(..., 0.06)
// reproduces that exact value without hardcoding it here.
export function headerBandShadow(theme: Theme): string {
  return `0 2px 6px ${alpha(theme.palette.text.primary, 0.06)}`
}
