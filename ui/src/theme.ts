import { createTheme } from '@mui/material/styles'
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
