import { useLayoutEffect, useRef, useState } from 'react'
import { alpha, darken, lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import type { SystemStyleObject } from '@mui/system'

// The look shared by the Availability players grid and the Team selection Players grid (docs/specs/093): a scroll box
// with a sticky first column and sticky, fixed-height header rows. Extracted from AvailabilityGrid, unchanged.
export const SCROLL_BOX_MIN_HEIGHT = 150
export const DATE_ROW_HEIGHT = 30
export const SLOT_ROW_HEIGHT = 24
// The player column sizes to its content between these bounds; the real width is measured at runtime
// (see useFirstColWidth) so the sticky date headers and scrollToGame offsets clear it exactly.
export const FIRST_COL_MIN_WIDTH = { xs: 150, sm: 180 }
export const FIRST_COL_MAX_WIDTH = 320
export const GAME_COL_WIDTH = { xs: 104, sm: 128 }
export const COUNT_COL_WIDTH = 64

export const stickyFirstColSx: SystemStyleObject<Theme> = {
  position: 'sticky',
  left: 0,
  bgcolor: 'background.paper',
  width: 'max-content',
  minWidth: FIRST_COL_MIN_WIDTH,
  maxWidth: FIRST_COL_MAX_WIDTH,
  // The right-hand edge reads as a divider with a soft shadow, so scrolled columns visibly pass under it.
  boxShadow: (theme: Theme) => `inset -1px 0 0 ${theme.palette.divider}, 2px 0 4px ${alpha(theme.palette.text.primary, 0.06)}`,
}

export const headCellSx: SystemStyleObject<Theme> = {
  position: 'sticky',
  bgcolor: 'background.paper',
  fontWeight: 600,
  p: 0.5,
  whiteSpace: 'nowrap',
  textAlign: 'center',
}

// Opaque tints (never alpha) so the sticky player cell never lets scrolled content show through.
export const hoverTint = (theme: Theme) =>
  theme.palette.mode === 'dark' ? darken(theme.palette.primary.main, 0.6) : lighten(theme.palette.primary.main, 0.86)

export const numberSx = { fontVariantNumeric: 'tabular-nums' }

// A sticky header row whose height cannot grow: the cell's border-box height is pinned to the
// constant (TableRow height is only a minimum) and its content clipped, so the next sticky row's
// `top` (the exact sum of the pinned heights above it) never overlaps or leaves a gap.
export function pinnedHeightSx(height: number): SystemStyleObject<Theme> {
  return { height, maxHeight: height, boxSizing: 'border-box', py: 0, lineHeight: `${height}px`, overflow: 'clip' }
}

export const clampTwoLinesSx = {
  fontWeight: 600,
  lineHeight: 1.25,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  wordBreak: 'break-word',
}

// The first column is content-sized, so measure it: the sticky date labels and the scroll margin need its real width.
// `deps` re-measure when the rows change.
export function useFirstColWidth(deps: unknown[]) {
  const ref = useRef<HTMLTableCellElement>(null)
  const [width, setWidth] = useState<number>(FIRST_COL_MIN_WIDTH.sm)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const measure = () => {
      const measured = Math.round(element.getBoundingClientRect().width)
      if (measured > 0) setWidth(measured)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { ref, width }
}
