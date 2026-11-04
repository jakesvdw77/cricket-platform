import { Link as RouterLink, useLocation } from 'react-router-dom'
import { Link } from '@mui/material'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'

// docs/specs/136 (page-anatomy section 5 and 7a, 2026-11-04): a player's name is a link to the player page, carrying returnTo so Back returns to this view.
export function PlayerNameLink({ playerId, name, originLabel = 'Availability', title, ariaLabel }: { playerId: string; name: string; originLabel?: string; title?: string; ariaLabel?: string }) {
  const location = useLocation()
  return (
    <Link component={RouterLink} to={withReturnTo(`/manage/players/${playerId}`, currentOrigin(location), originLabel)} variant="body2" title={title} aria-label={ariaLabel} underline="hover" color="inherit" sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>
      {name}
    </Link>
  )
}
