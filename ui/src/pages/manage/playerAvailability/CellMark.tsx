import { Box } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import type { SystemStyleObject } from '@mui/system'
import type { CellStatus } from '../../../api/playerAvailabilityApi'
import { statusTintSx } from '../../../utils/availabilityStatus'

export const CELL_MARK_SIZE = 26

const GLYPH: Partial<Record<CellStatus, string>> = {
  AVAILABLE: '✓',
  UNSURE: '?',
  UNAVAILABLE: '✕',
}

const circleSx: SystemStyleObject<Theme> = {
  width: CELL_MARK_SIZE,
  height: CELL_MARK_SIZE,
  borderRadius: '50%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  lineHeight: 1,
  boxSizing: 'border-box',
}

// docs/specs/068: one grid cell. The glyph carries the meaning (tick, question mark, cross, hollow
// dashed circle, dash), the tint only reinforces it, so no state is colour alone. `label` is the
// accessible name and tooltip; `pickedRing` (opt-in, the Team selection grid) adds a primary ring round a picked mark so
// the picked state reads at a glance on top of the answer; the Legend passes none and renders the same mark decoratively.
export function CellMark({ status, picked = false, label, pickedRing = false }: { status: CellStatus; picked?: boolean; label?: string; pickedRing?: boolean }) {
  const answered = status === 'AVAILABLE' || status === 'UNSURE' || status === 'UNAVAILABLE'

  return (
    <Box
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      title={label}
      data-status={status}
      data-picked={picked ? 'true' : undefined}
      sx={{
        position: 'relative',
        display: 'inline-flex',
        width: CELL_MARK_SIZE,
        height: CELL_MARK_SIZE,
        verticalAlign: 'middle',
        ...(picked && pickedRing ? { borderRadius: '50%', boxShadow: (theme: Theme) => `0 0 0 2px ${theme.palette.primary.main}` } : {}),
      }}
    >
      {answered && (
        <Box component="span" aria-hidden sx={{ ...circleSx, ...statusTintSx(status) }}>
          {GLYPH[status]}
        </Box>
      )}
      {status === 'NO_RESPONSE' && (
        <Box
          component="span"
          aria-hidden
          sx={{ ...circleSx, border: 2, borderStyle: 'dashed', borderColor: 'text.secondary', bgcolor: 'transparent' }}
        />
      )}
      {status === 'NOT_IN_POLL' && (
        <Box component="span" aria-hidden sx={{ ...circleSx, color: 'text.secondary', fontWeight: 600 }}>
          {'–'}
        </Box>
      )}
      {picked && (
        <Box
          component="span"
          data-testid="picked-dot"
          aria-hidden
          sx={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            border: 2,
            borderColor: 'background.paper',
            boxSizing: 'border-box',
          }}
        />
      )}
    </Box>
  )
}
