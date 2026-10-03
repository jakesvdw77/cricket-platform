import { Navigate, useLocation } from 'react-router-dom'

// docs/specs/073-availability-hub.md: the old /manage/player-availability (068) now lives at
// /manage/availability/players; old bookmarks land there, keeping the incoming query string.
export default function PlayerAvailabilityRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/manage/availability/players${search}`} replace />
}
