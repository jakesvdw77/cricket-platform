import { IconButton, Tooltip } from '@mui/material'
import DirectionsOutlinedIcon from '@mui/icons-material/DirectionsOutlined'
import { useGetDirections } from '../GetDirectionsButton/GetDirectionsButton'
import type { DirectionsTarget } from '../../utils/fieldLocation'

export interface VenueDirectionsButtonProps {
  // Where to go; null (or omitted) renders nothing, so a venue with no position shows no control.
  target: DirectionsTarget | null | undefined
  // The venue's name, for the accessible name ("Get Directions to Hofmeyer Park").
  venue: string
  testId?: string
}

// docs/specs/133 and docs/specs/137 (owner, 2026-11-05): the Get Directions icon button at the right end of a venue line on a match card (the Matches list and
// Team Selection). It opens Google Maps in a new tab on a desktop and the map-app sheet on a touch device, through the same hook as the
// Manage menus, and it is hidden when the venue has no usable position. Lifted above a card's stretched link so it is clickable.
export function VenueDirectionsButton({ target, venue, testId = 'venue-directions' }: VenueDirectionsButtonProps) {
  const { start, sheet } = useGetDirections(target)
  if (!target) return null
  return (
    <>
      <Tooltip title={target.approximate ? 'Get Directions (approximate)' : 'Get Directions'}>
        <IconButton
          size="small"
          color="primary"
          aria-label={`Get Directions to ${venue}`}
          onClick={start}
          data-testid={testId}
          // A real button: a round hairline-edged 30 px target with a small icon, not a loose glyph beside the text.
          sx={{ position: 'relative', zIndex: 1, width: 30, height: 30, border: 1, borderColor: 'primary.main', bgcolor: 'background.paper', '&:hover': { bgcolor: 'action.hover' } }}
        >
          <DirectionsOutlinedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      {sheet}
    </>
  )
}
