import { Box } from '@mui/material'
import { CELL_MARK_SIZE } from '../playerAvailability/CellMark'

export interface PickMarkProps {
  picked: boolean
}

// docs/specs/093-team-selection-hub.md: the Players grid mark. Picked is a filled tick, not picked a faint hollow circle.
// The glyph and the fill carry the meaning, the colour only reinforces it. Decorative: the cell button names it.
export function PickMark({ picked }: PickMarkProps) {
  return (
    <Box
      component="span"
      aria-hidden
      data-picked={picked ? 'true' : 'false'}
      data-testid="pick-mark"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: CELL_MARK_SIZE,
        height: CELL_MARK_SIZE,
        borderRadius: '50%',
        boxSizing: 'border-box',
        fontSize: 14,
        lineHeight: 1,
        verticalAlign: 'middle',
        ...(picked
          ? { bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 700 }
          : { border: 2, borderStyle: 'solid', borderColor: 'divider', bgcolor: 'transparent' }),
      }}
    >
      {picked ? '✓' : null}
    </Box>
  )
}
