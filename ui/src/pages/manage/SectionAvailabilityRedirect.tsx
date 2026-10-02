import { Navigate, useLocation } from 'react-router-dom'

// docs/specs/064: /manage/section-availability -> NewPollPage's group branch, preserving the incoming
// query string (sectionId, matchId).
export default function SectionAvailabilityRedirect() {
  const { search } = useLocation()
  const params = new URLSearchParams(search)
  params.set('type', 'group')
  return <Navigate to={`/manage/availability/new?${params.toString()}`} replace />
}
