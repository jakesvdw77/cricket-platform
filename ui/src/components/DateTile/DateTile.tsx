import { Box } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { displayLabelSx } from '../../theme'

export interface DateTileProps {
  // An ISO date or date-time.
  date: string
}

// A calendar-style tile for a dated item in a list or dialog (docs/specs/136, owner-approved option A): the weekday, the day number
// and the month on a light primary tint. Decorative: the row carries the full date as text, so the tile is hidden from assistive tech.
export function DateTile({ date }: DateTileProps) {
  const value = new Date(date)
  const weekday = value.toLocaleDateString(undefined, { weekday: 'short' })
  const month = value.toLocaleDateString(undefined, { month: 'short' })
  const small = { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1 } as const
  return (
    <Box
      aria-hidden
      data-testid="date-tile"
      sx={(theme) => ({
        width: 56,
        flex: 'none',
        textAlign: 'center',
        borderRadius: 2,
        py: 0.75,
        bgcolor: alpha(theme.palette.primary.main, 0.12),
        color: 'primary.dark',
      })}
    >
      <Box component="span" sx={small}>
        {weekday}
      </Box>
      <Box component="span" sx={{ ...displayLabelSx, display: 'block', fontSize: 28, fontWeight: 700, lineHeight: 1.1, letterSpacing: 0, my: 0.25 }}>
        {value.getDate()}
      </Box>
      <Box component="span" sx={small}>
        {month}
      </Box>
    </Box>
  )
}
