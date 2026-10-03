import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { CellMark } from './CellMark'

function Item({ mark, children }: { mark: ReactNode; children: string }) {
  return (
    <Box component="li" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, listStyle: 'none' }}>
      {mark}
      <Typography variant="caption" color="text.secondary">
        {children}
      </Typography>
    </Box>
  )
}

// docs/specs/068: the key under the grid. Wraps onto further lines on a phone, never clips.
export function Legend() {
  return (
    <Box
      component="ul"
      aria-label="Legend"
      sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2.5, rowGap: 1, m: 0, p: 0 }}
    >
      <Item mark={<CellMark status="AVAILABLE" />}>Available</Item>
      <Item mark={<CellMark status="UNSURE" />}>Unsure</Item>
      <Item mark={<CellMark status="UNAVAILABLE" />}>Unavailable</Item>
      <Item mark={<CellMark status="NO_RESPONSE" />}>No response</Item>
      <Item mark={<CellMark status="NOT_IN_POLL" />}>Not in this game's poll (or no poll)</Item>
      <Item mark={<CellMark status="AVAILABLE" picked />}>Picked for the match</Item>
    </Box>
  )
}
