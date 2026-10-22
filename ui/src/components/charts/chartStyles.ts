import { getContrastRatio, useTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'

// docs/specs/117-stats-dashboard.md ("Styling and accessibility"): the one place that turns theme tokens into chart colours and
// fill patterns. Library-free on purpose (no @mui/x-charts import), so a page may import the tone and pattern names.
// Colour is never the only cue: every category also has a fill pattern, a label or a legend text.

export type ChartTone = 'primary' | 'info' | 'warning' | 'success' | 'error' | 'grey'
export type PatternKind = 'solid' | 'diagonal' | 'dots' | 'vertical' | 'horizontal' | 'cross'

export interface CategoryStyle {
  tone: ChartTone
  pattern: PatternKind
}

// One fixed look per category, keyed by the category itself and never by its position, so "Caught" or "Wides" is drawn the same on
// every card, filter and screen. Every tone + pattern pair below is distinct (a unit test pins it). Only theme tokens are used:
// grey is reserved for "Not itemised" / "No result" and purple is not a chart tone.
export const DISMISSAL_STYLES: Readonly<Record<string, CategoryStyle>> = {
  CAUGHT: { tone: 'primary', pattern: 'solid' },
  NOT_OUT: { tone: 'primary', pattern: 'diagonal' },
  RETIRED_NOT_OUT: { tone: 'primary', pattern: 'dots' },
  BOWLED: { tone: 'info', pattern: 'solid' },
  CAUGHT_AND_BOWLED: { tone: 'info', pattern: 'dots' },
  DID_NOT_BAT: { tone: 'info', pattern: 'vertical' },
  LBW: { tone: 'warning', pattern: 'diagonal' },
  HIT_WICKET: { tone: 'warning', pattern: 'cross' },
  RETIRED_OUT: { tone: 'warning', pattern: 'dots' },
  STUMPED: { tone: 'success', pattern: 'vertical' },
  HANDLED_BALL: { tone: 'success', pattern: 'dots' },
  TIMED_OUT: { tone: 'success', pattern: 'cross' },
  RUN_OUT: { tone: 'error', pattern: 'horizontal' },
  OBSTRUCTING_FIELD: { tone: 'error', pattern: 'dots' },
  HIT_BALL_TWICE: { tone: 'error', pattern: 'cross' },
}

// A type the map does not know yet (the server added one) still gets a stable look of its own.
const UNKNOWN_DISMISSAL_STYLE: CategoryStyle = { tone: 'info', pattern: 'cross' }

// Shared by the player's How you were dismissed and Wickets by type donuts.
export function dismissalStyle(type: string): CategoryStyle {
  return DISMISSAL_STYLES[type] ?? UNKNOWN_DISMISSAL_STYLE
}

export type ExtrasKey = 'wides' | 'noBalls' | 'byes' | 'legByes' | 'penaltyRuns'

export const EXTRAS_STYLES: Readonly<Record<ExtrasKey, CategoryStyle>> = {
  wides: { tone: 'info', pattern: 'solid' },
  noBalls: { tone: 'warning', pattern: 'diagonal' },
  byes: { tone: 'primary', pattern: 'dots' },
  legByes: { tone: 'success', pattern: 'vertical' },
  penaltyRuns: { tone: 'error', pattern: 'horizontal' },
}

// The grey "Not itemised" / unknown segment: the same label and tone on the team Extras card and the player Wickets by type card.
export const NOT_ITEMISED_STYLE: CategoryStyle = { tone: 'grey', pattern: 'solid' }

export interface ChartPalette {
  tones: Record<ChartTone, string>
  grid: string
  axisText: string
  text: string
  paper: string
  fontFamily: string
}

// A light club primary that fails 3:1 against the card falls back to primary.dark (spec question 16).
export function chartPalette(theme: Theme): ChartPalette {
  const { palette } = theme
  const paper = palette.background.paper
  const primary = getContrastRatio(palette.primary.main, paper) >= 3 ? palette.primary.main : palette.primary.dark
  // grey[500] is 2.7:1 on white; the neutral "Not itemised" / "No result" tone takes the next shade that reaches 3:1
  const grey = getContrastRatio(palette.grey[600], paper) >= 3 ? palette.grey[600] : palette.grey[800]
  return {
    tones: {
      primary,
      info: palette.info.main,
      warning: palette.warning.main,
      success: palette.success.main,
      error: palette.error.main,
      grey,
    },
    grid: palette.divider,
    axisText: palette.text.secondary,
    text: palette.text.primary,
    paper,
    fontFamily: theme.typography.fontFamily ?? 'inherit',
  }
}

export function useChartPalette(): ChartPalette {
  return chartPalette(useTheme())
}

// The id of a pattern is only safe inside url(#...) without React's punctuation.
export function safeSvgId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '')
}

export function patternId(scope: string, key: string): string {
  return safeSvgId(`${scope}-${key}`)
}

// The fill of a category: the tone itself for solid, otherwise a reference to its <pattern>.
export function fillFor(scope: string, key: string, style: CategoryStyle, palette: ChartPalette): string {
  return style.pattern === 'solid' ? palette.tones[style.tone] : `url(#${patternId(scope, key)})`
}
