import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { CellMark } from './CellMark'

function Item({ mark, children }: { mark: ReactNode; children: string }) {
  return (
    <Box component="li" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, listStyle: 'none' }}>
      {mark}
      <Typography variant="caption" color="text.secondary">
        {children}
      </Typography>
    </Box>
  )
}

export interface LegendProps {
  // docs/specs/085 (E): the phone lists word the "not in this game's poll" entry as "No poll".
  phone?: boolean
}

// docs/specs/068 + 085 (D3): the key of the marks, one compact row (tight gaps, caption text) that sits above the grid
// (or under the phone switch). Wraps onto further lines on a narrow screen, never clips.
export function Legend({ phone = false }: LegendProps) {
  return (
    <Box
      component="ul"
      aria-label="Legend"
      sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1.75, rowGap: 0.5, m: 0, p: 0 }}
    >
      <Item mark={<CellMark status="AVAILABLE" />}>Available</Item>
      <Item mark={<CellMark status="UNSURE" />}>Unsure</Item>
      <Item mark={<CellMark status="UNAVAILABLE" />}>Unavailable</Item>
      <Item mark={<CellMark status="NO_RESPONSE" />}>No response</Item>
      <Item mark={<CellMark status="NOT_IN_POLL" />}>{phone ? 'No poll' : "Not in this game's poll (or no poll)"}</Item>
      <Item mark={<CellMark status="AVAILABLE" picked />}>Picked for the match</Item>
    </Box>
  )
}
