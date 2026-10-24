import { createTheme, darken, getContrastRatio } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { BRAND, CHROME, FONT_BODY, FONT_DISPLAY, GROUND_GRADIENT } from './brandTokens'

// docs/specs/072-league-view-pages.md: the one structural purple, used for the league "format"
// badge tone. It has no counterpart in the semantic palette and never varies per club. Exported so
// a component rendered outside a ThemeProvider (tests, stories) can still fall back to it.
export const STRUCTURAL_PURPLE = { main: '#7b5cc4', dark: '#5b3d99' }

// docs/specs/120: the chrome palette (header, side menu, bottom bar, Menu sheet, footer). Fixed platform greens and gold
// for every club, so it is never touched by withClubBranding.
export interface ChromePalette {
  header: string
  menu: string
  menuLine: string
  text: string
  selected: string
  selectedBg: string
  hover: string
}

declare module '@mui/material/styles' {
  interface Palette {
    purple: { main: string; dark: string }
    chrome: ChromePalette
  }
  interface PaletteOptions {
    purple?: { main: string; dark: string }
    chrome?: ChromePalette
  }
}

// The display face (Barlow Condensed) for page titles, menu labels, numerals and avatar initials.
declare module '@mui/material/styles/createTypography' {
  interface Typography {
    fontFamilyDisplay: string
  }
  interface TypographyOptions {
    fontFamilyDisplay?: string
  }
}

// Structural design tokens: docs/standards/design-system.md. Same values as
// the old cricketlegend app's ui/src/theme.ts pattern (createTheme, MUI v5),
// carried forward for this project rather than reinvented. Colours and font stacks come from brandTokens.ts.
export const baseTheme: Theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: BRAND.green700, dark: BRAND.green800, contrastText: '#ffffff' },
    success: { main: '#0e7c66' },
    warning: { main: '#b7791f' },
    error: { main: '#b0402e' },
    info: { main: '#2563ac' },
    purple: STRUCTURAL_PURPLE,
    chrome: CHROME,
    background: { default: BRAND.groundEnd, paper: '#ffffff' },
    text: { primary: BRAND.ink900, secondary: BRAND.inkMuted },
    divider: BRAND.cardLine,
  },
  typography: {
    fontFamily: FONT_BODY,
    fontFamilyDisplay: FONT_DISPLAY,
  },
  shape: { borderRadius: 6 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      // docs/specs/120 Decision 22: a club colour that fails contrast as text on white or the cream ground falls back to a
      // readable shade (contained buttons keep the club colour as a fill).
      styleOverrides: {
        textPrimary: ({ theme }) => ({ color: readablePrimary(theme, 'text') }),
        outlinedPrimary: ({ theme }) => ({ color: readablePrimary(theme, 'text'), borderColor: readablePrimary(theme, 'edge') }),
      },
    },
    MuiLink: {
      styleOverrides: {
        root: ({ theme, ownerState }) => (ownerState.color === 'primary' || ownerState.color === undefined ? { color: readablePrimary(theme, 'text') } : {}),
      },
    },
    MuiTab: {
      styleOverrides: {
        root: ({ theme }) => ({ '&.Mui-selected': { color: readablePrimary(theme, 'text') } }),
      },
    },
    // Cards sit on the cream ground with the card hairline (a variant="outlined" card already has the same border).
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({ border: `1px solid ${theme.palette.divider}` }),
      },
    },
  },
})

// docs/specs/120 Decision 22: the colour to use for a club's primary as TEXT ('text', 4.5:1) or as a thin control edge
// ('edge', 3:1) on both the white card and the darkest stop of the cream ground. The club colour itself when it passes,
// otherwise primary.dark, darkened further until it does, so no accepted colour yields unreadable text. Fills keep the club colour.
export function readablePrimary(theme: Theme, kind: 'text' | 'edge' = 'text'): string {
  const minimum = kind === 'text' ? 4.5 : 3
  const grounds = ['#ffffff', BRAND.groundTop]
  const passes = (colour: string) => grounds.every((ground) => getContrastRatio(colour, ground) >= minimum)
  const { main, dark } = theme.palette.primary
  if (passes(main)) return main
  let candidate = dark
  for (let step = 0; step < 20 && !passes(candidate); step += 1) {
    candidate = darken(candidate, 0.1)
  }
  return candidate
}

// The one runtime override, see docs/specs/001-tenancy-identity-model.md's
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

// The page ground every post-login shell (AppShell, ManagerShell, BottomTabShell) applies to its <main> only, never the
// header/footer, which stay solid chrome. docs/specs/120 Decision 10: a fixed cream gradient for every club (it used to be
// tinted by primary); a club's colour shows on buttons, links, counters and chips. The signature is kept so the shells need no change.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function pageBackgroundGradient(_theme: Theme): string {
  return GROUND_GRADIENT
}

// docs/specs/120 Decision 8: the shared display-face pieces. Page titles are 32 px on a phone and 40 px from md,
// Barlow Condensed 700, uppercase, 0.05em; a card name is about 21 px, uppercase, 0.03em.
export const pageTitleSx = {
  fontFamily: FONT_DISPLAY,
  fontWeight: 700,
  fontSize: { xs: 32, md: 40 },
  lineHeight: 1,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
} as const

export const cardTitleSx = {
  fontFamily: FONT_DISPLAY,
  fontWeight: 600,
  fontSize: '1.3rem',
  lineHeight: 1.15,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
} as const

// Small uppercase display-face labels (menu group headings, counter labels use their own tracking).
export const displayLabelSx = {
  fontFamily: FONT_DISPLAY,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
} as const
