import { getContrastRatio, useTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { STRUCTURAL_PURPLE } from '../../theme'

// docs/specs/117-stats-dashboard.md ("Styling and accessibility"): the one place that turns theme tokens into chart colours and
// fill patterns. Library-free on purpose (no @mui/x-charts import), so a page may import the tone and pattern names.
// Colour is never the only cue: every category also has a fill pattern, a label or a legend text.

export type ChartTone = 'primary' | 'info' | 'warning' | 'success' | 'error' | 'purple' | 'grey'
export type PatternKind = 'solid' | 'diagonal' | 'dots' | 'vertical' | 'horizontal' | 'cross'

export interface CategoryStyle {
  tone: ChartTone
  pattern: PatternKind
}

// Distinct tone + pattern pairs for a categorical series (dismissal types, extras types), in a fixed order.
export const CATEGORY_STYLES: readonly CategoryStyle[] = [
  { tone: 'primary', pattern: 'solid' },
  { tone: 'info', pattern: 'solid' },
  { tone: 'warning', pattern: 'diagonal' },
  { tone: 'purple', pattern: 'dots' },
  { tone: 'success', pattern: 'vertical' },
  { tone: 'error', pattern: 'horizontal' },
  { tone: 'info', pattern: 'cross' },
]

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
  return {
    tones: {
      primary,
      info: palette.info.main,
      warning: palette.warning.main,
      success: palette.success.main,
      error: palette.error.main,
      purple: (palette.purple ?? STRUCTURAL_PURPLE).main,
      grey: palette.grey[500],
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
