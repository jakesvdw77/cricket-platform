import { Link as RouterLink } from 'react-router-dom'
import { Link } from '@mui/material'
import { resultViewTo } from '../../results/resultListHelpers'

// A table row's date: a link to the result page, router state carrying the way back (spec 115: ResultDetailPage honours `backTo`
// only when it starts with /manage/). Shared by the player and the team Dashboard tables.
export function DashboardResultLink({ matchId, label, backTo, backLabel }: { matchId: string; label: string; backTo: string; backLabel: string }) {
  return (
    <Link component={RouterLink} to={resultViewTo(matchId)} state={{ backTo, backLabel }} underline="hover" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
      {label}
    </Link>
  )
}
