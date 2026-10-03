import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'

// docs/specs/074-availability-coverage.md section 6.3: the non-component parts of CoverageBar (segment
// styles shared with the legend, the props and the aria-label text), kept out of the component file.

// Shared with the legend swatches so the two can never drift apart.
export const ownSegmentSx = { bgcolor: 'primary.main' } as const
export const sharedSegmentSx = {
  backgroundImage: (theme: Theme) =>
    `repeating-linear-gradient(45deg, ${theme.palette.info.main} 0 3px, ${alpha(theme.palette.info.main, 0.55)} 3px 6px)`,
} as const

export interface CoverageBarProps {
  teamName: string
  available: number
  ownOnly: number
  shared: number
  // null: no playing XI size known, so no tick and the scale is `available`.
  needed: number | null
  // false: nothing to show yet, an empty track.
  hasPoll?: boolean
}

export function coverageBarLabel({ teamName, available, ownOnly, shared, needed, hasPoll = true }: CoverageBarProps): string {
  if (!hasPoll) {
    return `${teamName}: no poll yet${needed !== null ? `, ${needed} needed` : ''}`
  }
  const parts = [`${available} available`]
  if (shared > 0) {
    parts.push(`${ownOnly} only this team`, `${shared} also available for another team`)
  }
  if (needed !== null) parts.push(`${needed} needed`)
  return `${teamName}: ${parts.join(', ')}`
}

