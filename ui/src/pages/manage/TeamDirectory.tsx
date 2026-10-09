import { useOutletContext } from 'react-router-dom'
import type { RecordCardBadge } from '../../components/RecordCard'
import type { Team } from '../../api/teamApi'
import { TeamsPage } from './teams/TeamsPage'

// Exported for TeamDetailPage.tsx (docs/specs/036-view-first-record-detail-screens.md) so the read-only view screen's
// badge matches the list's, rather than a second copy.
export function badgeFor(team: Team): RecordCardBadge | undefined {
  if (!team.active) {
    return { label: 'Inactive', tone: 'muted' }
  }
  return undefined
}

// Reads clubId from ManagerHome's Outlet context (docs/specs/020-club-manager-access.md) only - no route param, unlike
// the section-scoped TeamList.tsx. The page itself is the shared TeamsPage (docs/specs/092-teams-gold-standard.md), here
// across the whole club with the persisted Section filter (035, 043).
export default function TeamDirectory() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  return <TeamsPage clubId={clubId} scope={{ kind: 'club' }} />
}
