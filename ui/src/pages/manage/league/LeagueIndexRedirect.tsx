import { Navigate, useLocation } from 'react-router-dom'

// docs/specs/072-league-view-pages.md section 1: the bare league URL (old bookmarks, the Back link on
// LeagueContactDetailPage) replaces itself with the Schedule, keeping ?seasonId=.
export default function LeagueIndexRedirect() {
  const { search } = useLocation()
  return <Navigate to={{ pathname: 'schedule', search }} replace />
}
