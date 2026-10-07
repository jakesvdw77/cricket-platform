import { alpha, createTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'

// docs/specs/072-league-view-pages.md: the one structural purple, used for the league "format"
// badge tone. It has no counterpart in the semantic palette and never varies per club. Exported so
// a component rendered outside a ThemeProvider (tests, stories) can still fall back to it.
export const STRUCTURAL_PURPLE = { main: '#7b5cc4', dark: '#5b3d99' }

declare module '@mui/material/styles' {
  interface Palette {
    purple: { main: string; dark: string }
  }
  interface PaletteOptions {
    purple?: { main: string; dark: string }
  }
}

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
    purple: STRUCTURAL_PURPLE,
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
  // docs/specs/079: merging only `main` kept the base theme's explicit `dark` and white
  // `contrastText`, so a light club colour got white text on it. Let MUI derive light/dark/
  // contrastText for the club colour; the platform default keeps its hand-tuned values.
  if (primaryColor.toLowerCase() === baseTheme.palette.primary.main.toLowerCase()) {
    return baseTheme
  }
  return createTheme(baseTheme, {
    palette: { primary: baseTheme.palette.augmentColor({ color: { main: primaryColor }, name: 'primary' }) },
  })
}

// The page-body wash every post-login shell (AppShell, ManagerShell, BottomTabShell) applies to
// its <main> only — never the header/footer, which stay solid so brand chrome doesn't compete
// with it. A CSS gradient rather than a static image: derived from theme.palette.primary, so it
// re-tints automatically per club via withClubBranding() instead of showing the same fixed image
// regardless of which club is viewing it. Replaces flat white as every shell's body background.
export function pageBackgroundGradient(theme: Theme): string {
  return `linear-gradient(160deg, ${alpha(theme.palette.primary.main, 0.14)} 0%, ${alpha(theme.palette.primary.main, 0.03)} 45%, ${theme.palette.background.default} 75%)`
}
