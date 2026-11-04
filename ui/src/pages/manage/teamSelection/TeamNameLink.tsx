import { Link as RouterLink, useLocation } from 'react-router-dom'
import { Link } from '@mui/material'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'

// docs/specs/137 (page-anatomy section 5): a team's name is a link to the team page, carrying returnTo so Back returns to this view.
export function TeamNameLink({ sectionId, teamId, name, originLabel = 'Team Selection', sx }: { sectionId: string; teamId: string; name: string; originLabel?: string; sx?: object }) {
  const location = useLocation()
  return (
    <Link
      component={RouterLink}
      to={withReturnTo(`/manage/sections/${sectionId}/teams/${teamId}`, currentOrigin(location), originLabel)}
      color="inherit"
      underline="hover"
      // Above a row's stretched link, so the name itself is clickable.
      sx={{ position: 'relative', zIndex: 1, ...sx }}
    >
      {name}
    </Link>
  )
}
