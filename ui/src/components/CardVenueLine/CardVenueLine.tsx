import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'

export interface CardVenueLineProps {
  // The venue: plain text, or a link to the field with its flags.
  children: ReactNode
  // The Get Directions button at the right end (it lifts itself above a card's stretched link).
  trailing?: ReactNode
}

// docs/specs/137 (owner, 2026-11-05): the venue is part of a match card's sub-title, under the league and season, with a small place icon in
// the same secondary text as the line above and the Get Directions button at the right end. Used by the Matches cards and the Team Selection cards.
export function CardVenueLine({ children, trailing }: CardVenueLineProps) {
  return (
    <Box data-testid="card-venue-line" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
      <Box component="span" aria-hidden sx={{ display: 'inline-flex', color: 'text.secondary' }}>
        <PlaceOutlinedIcon sx={{ fontSize: 18 }} />
      </Box>
      <Box component="span" sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', fontSize: '0.875rem', color: 'text.secondary' }}>
        {children}
      </Box>
      {trailing}
    </Box>
  )
}
