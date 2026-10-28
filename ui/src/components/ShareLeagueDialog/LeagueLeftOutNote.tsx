import { Typography } from '@mui/material'
import { leftOutNote } from '../../utils/share/leagueShareFormats'
import type { LeagueShareFormat } from '../../utils/share/leagueShareFormats'

// A small note on a format screen when something ticked is not part of this output (not a block).
export function LeagueLeftOutNote({ format, ticked }: { format: LeagueShareFormat; ticked: readonly string[] }) {
  const note = leftOutNote(format, ticked)
  if (!note) return null
  return (
    <Typography variant="caption" color="text.secondary" role="note" component="p" sx={{ mb: 1.5 }}>
      {note}
    </Typography>
  )
}
